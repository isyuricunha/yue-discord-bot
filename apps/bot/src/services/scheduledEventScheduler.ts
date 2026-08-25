import { Client, EmbedBuilder } from 'discord.js'
import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import { logger } from '../utils/logger'
import { getSendableChannel } from '../utils/discord'
import { safe_error_details } from '../utils/safe_error'

const CLAIM_LEASE_MS = 5 * 60 * 1000

type scheduled_event_row = {
  id: string
  guildId: string
  channelId: string
  title: string
  description: string | null
  startsAt: Date
}

function to_unix_seconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

export class ScheduledEventScheduler {
  private interval: NodeJS.Timeout | null = null
  private running = false

  constructor(private client: Client) {}

  start() {
    if (this.interval) return
    this.interval = setInterval(() => void this.tick(), 30 * 1000)
    void this.tick()
    logger.info('📅 Scheduler de eventos agendados iniciado')
  }

  stop() {
    if (!this.interval) return
    clearInterval(this.interval)
    this.interval = null
    logger.info('📅 Scheduler de eventos agendados parado')
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      const now = new Date()
      await this.process_24h(now)
      await this.process_1h(now)
      await this.process_10m(now)
      await this.mark_due_as_ended(now)
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao processar scheduler de eventos agendados')
    } finally {
      this.running = false
    }
  }

  private async process_24h(now: Date) {
    const stale_claim = new Date(now.getTime() - CLAIM_LEASE_MS)
    const due = await prisma.scheduledEvent.findMany({
      where: {
        ended: false,
        cancelled: false,
        reminder24hSent: false,
        startsAt: { gt: now },
        reminder24hAt: { lte: now },
        OR: [{ reminder24hClaimedAt: null }, { reminder24hClaimedAt: { lt: stale_claim } }],
      },
      orderBy: [{ reminder24hAt: 'asc' }],
      take: 50,
      select: { id: true, guildId: true, channelId: true, title: true, description: true, startsAt: true },
    })

    for (const event of due) {
      const claimed = await prisma.scheduledEvent.updateMany({
        where: {
id: event.id,
reminder24hSent: false,
OR: [{ reminder24hClaimedAt: null }, { reminder24hClaimedAt: { lt: stale_claim } }],
        },
        data: { reminder24hClaimedAt: now },
      })
      if (claimed.count === 0) continue

      try {
        await this.send_reminder_message(event, '⏰ Faltam 24 horas')
        await prisma.scheduledEvent.updateMany({
where: { id: event.id, reminder24hSent: false },
data: { reminder24hSent: true, reminder24hClaimedAt: null },
        })
      } catch (error) {
        await prisma.scheduledEvent.updateMany({ where: { id: event.id }, data: { reminder24hClaimedAt: null } }).catch(() => undefined)
        logger.error({ err: safe_error_details(error), scheduledEventId: event.id }, 'Falha ao enviar reminder de 24h')
      }
    }
  }

  private async process_1h(now: Date) {
    const stale_claim = new Date(now.getTime() - CLAIM_LEASE_MS)
    const due = await prisma.scheduledEvent.findMany({
      where: {
        ended: false,
        cancelled: false,
        reminder1hSent: false,
        startsAt: { gt: now },
        reminder1hAt: { lte: now },
        OR: [{ reminder1hClaimedAt: null }, { reminder1hClaimedAt: { lt: stale_claim } }],
      },
      orderBy: [{ reminder1hAt: 'asc' }],
      take: 50,
      select: { id: true, guildId: true, channelId: true, title: true, description: true, startsAt: true },
    })

    for (const event of due) {
      const claimed = await prisma.scheduledEvent.updateMany({
        where: {
id: event.id,
reminder1hSent: false,
OR: [{ reminder1hClaimedAt: null }, { reminder1hClaimedAt: { lt: stale_claim } }],
        },
        data: { reminder1hClaimedAt: now },
      })
      if (claimed.count === 0) continue

      try {
        await this.send_reminder_message(event, '⏰ Faltam 1 hora')
        await prisma.scheduledEvent.updateMany({
where: { id: event.id, reminder1hSent: false },
data: { reminder1hSent: true, reminder1hClaimedAt: null },
        })
      } catch (error) {
        await prisma.scheduledEvent.updateMany({ where: { id: event.id }, data: { reminder1hClaimedAt: null } }).catch(() => undefined)
        logger.error({ err: safe_error_details(error), scheduledEventId: event.id }, 'Falha ao enviar reminder de 1h')
      }
    }
  }

  private async process_10m(now: Date) {
    const stale_claim = new Date(now.getTime() - CLAIM_LEASE_MS)
    const due = await prisma.scheduledEvent.findMany({
      where: {
        ended: false,
        cancelled: false,
        reminder10mSent: false,
        startsAt: { gt: now },
        reminder10mAt: { lte: now },
        OR: [{ reminder10mClaimedAt: null }, { reminder10mClaimedAt: { lt: stale_claim } }],
      },
      orderBy: [{ reminder10mAt: 'asc' }],
      take: 50,
      select: { id: true, guildId: true, channelId: true, title: true, description: true, startsAt: true },
    })

    for (const event of due) {
      const claimed = await prisma.scheduledEvent.updateMany({
        where: {
id: event.id,
reminder10mSent: false,
OR: [{ reminder10mClaimedAt: null }, { reminder10mClaimedAt: { lt: stale_claim } }],
        },
        data: { reminder10mClaimedAt: now },
      })
      if (claimed.count === 0) continue

      try {
        await this.send_reminder_message(event, '⏰ Faltam 10 minutos')
        await prisma.scheduledEvent.updateMany({
where: { id: event.id, reminder10mSent: false },
data: { reminder10mSent: true, reminder10mClaimedAt: null },
        })
      } catch (error) {
        await prisma.scheduledEvent.updateMany({ where: { id: event.id }, data: { reminder10mClaimedAt: null } }).catch(() => undefined)
        logger.error({ err: safe_error_details(error), scheduledEventId: event.id }, 'Falha ao enviar reminder de 10m')
      }
    }
  }

  private async send_reminder_message(event: scheduled_event_row, header: string) {
    const channel = await this.client.channels.fetch(event.channelId)
    const sendable = getSendableChannel(channel)
    if (!sendable) throw new Error('scheduled event channel is not sendable')

    const starts_ts = to_unix_seconds(new Date(event.startsAt))
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${header}: ${event.title}`)
      .addFields({ name: '📅 Começa', value: `<t:${starts_ts}:F> (<t:${starts_ts}:R>)`, inline: false })

    if (event.description) embed.setDescription(event.description)

    await sendable.send({
      content: `${EMOJIS.INFO} **Evento:** ${event.title}`,
      embeds: [embed],
      allowedMentions: { parse: [] },
    })
  }

  private async mark_due_as_ended(now: Date) {
    try {
      await prisma.scheduledEvent.updateMany({
        where: {
ended: false,
cancelled: false,
startsAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) },
        },
        data: { ended: true },
      })
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao finalizar eventos automaticamente')
    }
  }
}
