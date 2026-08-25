import { Client } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'
import { pollService, poll_option } from './poll.service'

const CLAIM_LEASE_MS = 5 * 60 * 1000

export class PollExpirationScheduler {
  private interval: NodeJS.Timeout | null = null
  private running = false

  constructor(private client: Client) {}

  start() {
    if (this.interval) return
    this.interval = setInterval(() => void this.tick(), 60_000)
    void this.tick()
    logger.info('📊 Poll expiration scheduler started')
  }

  stop() {
    if (!this.interval) return
    clearInterval(this.interval)
    this.interval = null
    logger.info('📊 Poll expiration scheduler stopped')
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      const now = new Date()
      const stale_claim = new Date(now.getTime() - CLAIM_LEASE_MS)
      const expiredPolls = await prisma.poll.findMany({
        where: {
          endsAt: { lte: now },
          AND: [
            { OR: [{ ended: false }, { expirationNotifiedAt: null }, { expirationMessageUpdatedAt: null }] },
            { OR: [{ expirationClaimedAt: null }, { expirationClaimedAt: { lt: stale_claim } }] },
          ],
        },
        orderBy: { endsAt: 'asc' },
        take: 50,
      })

      for (const poll of expiredPolls) {
        await this.handlePollExpiration(poll, now, stale_claim)
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Error processing poll expiration scheduler')
    } finally {
      this.running = false
    }
  }

  private async handlePollExpiration(
    poll: {
      id: string
      channelId: string
      messageId: string
      question: string
      options: unknown
      multiVote: boolean
      endsAt: Date
      createdAt: Date
      expirationNotifiedAt: Date | null
      expirationMessageUpdatedAt: Date | null
    },
    now: Date,
    stale_claim: Date,
  ) {
    const claimed = await prisma.poll.updateMany({
      where: {
        id: poll.id,
        OR: [{ expirationClaimedAt: null }, { expirationClaimedAt: { lt: stale_claim } }],
      },
      data: { ended: true, expirationClaimedAt: now },
    })
    if (claimed.count === 0) return

    try {
      if (!poll.expirationNotifiedAt) {
        const notified = await pollService.sendPollExpirationNotification(
          this.client as unknown as Parameters<typeof pollService.sendPollExpirationNotification>[0],
          {
            id: poll.id,
            channelId: poll.channelId,
            question: poll.question,
            options: poll.options as poll_option[],
          }
        )
        if (!notified) throw new Error('poll expiration notification was not sent')
        await prisma.poll.update({ where: { id: poll.id }, data: { expirationNotifiedAt: new Date() } })
      }

      if (!poll.expirationMessageUpdatedAt) {
        const message_updated = await pollService.updatePollMessage(
          {
            messageId: poll.messageId,
            channelId: poll.channelId,
            question: poll.question,
            options: poll.options as poll_option[],
            multiVote: poll.multiVote,
            endsAt: poll.endsAt,
            ended: true,
            createdAt: poll.createdAt,
          },
          this.client as unknown as Parameters<typeof pollService.updatePollMessage>[1]
        )
        if (!message_updated) throw new Error('poll message was not updated')
        await prisma.poll.update({ where: { id: poll.id }, data: { expirationMessageUpdatedAt: new Date() } })
      }

      logger.info({ pollId: poll.id, question: poll.question }, 'Poll expired and delivery completed')
    } catch (error) {
      logger.error({ err: safe_error_details(error), pollId: poll.id }, 'Failed to process poll expiration')
    } finally {
      await prisma.poll.updateMany({
        where: { id: poll.id, expirationClaimedAt: now },
        data: { expirationClaimedAt: null },
      }).catch(() => undefined)
    }
  }
}
