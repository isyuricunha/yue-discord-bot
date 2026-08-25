import test from 'node:test'
import assert from 'node:assert/strict'

import { prisma } from '@yuebot/database'

import { GiveawayScheduler } from './giveawayScheduler'
import { InventoryExpirationScheduler } from './inventoryExpirationScheduler'
import { pollService } from './poll.service'
import { PollExpirationScheduler } from './pollExpirationScheduler'
import { ScheduledEventScheduler } from './scheduledEventScheduler'
import { WarnExpirationService } from './warnExpirationService'

test('core runtime retry and idempotency guards', async (t) => {
  await t.test('warn expiration does not decrement twice when a stale warn is seen again', async () => {
    const original_find_many = (prisma.modLog as any).findMany
    const original_transaction = (prisma as any).$transaction

    let expired = false
    let warnings = 3
    let warning_updates = 0
    let expiration_logs = 0

    try {
      ;(prisma.modLog as any).findMany = async () => [
        { id: 'warn-1', userId: 'user-1', metadata: {} },
      ]

      ;(prisma as any).$transaction = async (operation: (tx: any) => Promise<unknown>) =>
        operation({
          modLog: {
            updateMany: async () => {
              if (expired) return { count: 0 }
              expired = true
              return { count: 1 }
            },
            create: async () => {
              expiration_logs += 1
              return {}
            },
          },
          guildMember: {
            findUnique: async () => ({ warnings }),
            update: async ({ data }: any) => {
              warnings = data.warnings
              warning_updates += 1
              return {}
            },
          },
        })

      const client = {
        user: { id: 'bot-1' },
        guilds: {
          cache: new Map([['guild-1', {}]]),
          fetch: async () => null,
        },
        users: { fetch: async () => null },
      }
      const service = new WarnExpirationService(client as any)

      await (service as any).expireWarnsForGuild('guild-1', 30)
      await (service as any).expireWarnsForGuild('guild-1', 30)

      assert.equal(warnings, 2)
      assert.equal(warning_updates, 1)
      assert.equal(expiration_logs, 1)
    } finally {
      ;(prisma.modLog as any).findMany = original_find_many
      ;(prisma as any).$transaction = original_transaction
    }
  })

  await t.test('scheduled event reminder releases a failed claim and succeeds on retry', async () => {
    const original_find_many = (prisma.scheduledEvent as any).findMany
    const original_update_many = (prisma.scheduledEvent as any).updateMany

    let claimed = false
    let sent = false
    let send_calls = 0

    const event = {
      id: 'event-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      title: 'Teste',
      description: null,
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
    }

    try {
      ;(prisma.scheduledEvent as any).findMany = async () => (sent ? [] : [event])
      ;(prisma.scheduledEvent as any).updateMany = async ({ data }: any) => {
        if (data.reminder24hSent === true) {
          sent = true
          claimed = false
          return { count: 1 }
        }
        if (data.reminder24hClaimedAt === null) {
          claimed = false
          return { count: 1 }
        }
        if (data.reminder24hClaimedAt instanceof Date) {
          if (claimed) return { count: 0 }
          claimed = true
          return { count: 1 }
        }
        return { count: 0 }
      }

      const client = {
        channels: {
          fetch: async () => ({
            id: 'channel-1',
            send: async () => {
              send_calls += 1
              if (send_calls === 1) throw new Error('temporary Discord failure')
              return {}
            },
          }),
        },
      }
      const scheduler = new ScheduledEventScheduler(client as any)
      const now = new Date()

      await (scheduler as any).process_24h(now)
      assert.equal(sent, false)
      assert.equal(claimed, false)

      await (scheduler as any).process_24h(now)
      assert.equal(sent, true)
      assert.equal(claimed, false)
      assert.equal(send_calls, 2)
    } finally {
      ;(prisma.scheduledEvent as any).findMany = original_find_many
      ;(prisma.scheduledEvent as any).updateMany = original_update_many
    }
  })

  await t.test('poll expiration retries only the delivery step that failed', async () => {
    const original_update_many = (prisma.poll as any).updateMany
    const original_update = (prisma.poll as any).update
    const original_notify = (pollService as any).sendPollExpirationNotification
    const original_message_update = (pollService as any).updatePollMessage

    let notified_at: Date | null = null
    let message_updated_at: Date | null = null
    let notify_calls = 0
    let message_update_calls = 0
    let claim_releases = 0

    const poll = {
      id: 'poll-1',
      channelId: 'channel-1',
      messageId: 'message-1',
      question: 'Pergunta?',
      options: [{ id: 0, text: 'A', votes: 1 }],
      multiVote: false,
      endsAt: new Date(Date.now() - 1000),
      createdAt: new Date(Date.now() - 60_000),
      expirationNotifiedAt: null as Date | null,
      expirationMessageUpdatedAt: null as Date | null,
    }

    try {
      ;(prisma.poll as any).updateMany = async ({ data }: any) => {
        if (data.expirationClaimedAt === null) claim_releases += 1
        return { count: 1 }
      }
      ;(prisma.poll as any).update = async ({ data }: any) => {
        if (data.expirationNotifiedAt instanceof Date) notified_at = data.expirationNotifiedAt
        if (data.expirationMessageUpdatedAt instanceof Date) message_updated_at = data.expirationMessageUpdatedAt
        return {}
      }
      ;(pollService as any).sendPollExpirationNotification = async () => {
        notify_calls += 1
        return true
      }
      ;(pollService as any).updatePollMessage = async () => {
        message_update_calls += 1
        return message_update_calls > 1 ? true : null
      }

      const scheduler = new PollExpirationScheduler({} as any)
      const now = new Date()
      const stale_claim = new Date(now.getTime() - 5 * 60 * 1000)

      await (scheduler as any).handlePollExpiration(poll, now, stale_claim)
      assert.ok(notified_at)
      assert.equal(message_updated_at, null)

      await (scheduler as any).handlePollExpiration(
        { ...poll, expirationNotifiedAt: notified_at },
        new Date(now.getTime() + 1000),
        stale_claim,
      )

      assert.ok(message_updated_at)
      assert.equal(notify_calls, 1)
      assert.equal(message_update_calls, 2)
      assert.equal(claim_releases, 2)
    } finally {
      ;(prisma.poll as any).updateMany = original_update_many
      ;(prisma.poll as any).update = original_update
      ;(pollService as any).sendPollExpirationNotification = original_notify
      ;(pollService as any).updatePollMessage = original_message_update
    }
  })

  await t.test('inventory expiration stays pending when Discord role removal fails', async () => {
    const original_find_many = (prisma.inventoryItem as any).findMany
    const original_update_many = (prisma.inventoryItem as any).updateMany

    let claimed = false
    let handled = false
    let remove_calls = 0

    const item = {
      id: 'item-1',
      userId: 'user-1',
      guildId: 'guild-1',
      kind: 'temp_role',
      metadata: { roleId: 'role-1' },
      expiresAt: new Date(Date.now() - 1000),
    }

    const member = {
      roles: {
        cache: { has: (role_id: string) => role_id === 'role-1' },
        remove: async () => {
          remove_calls += 1
          if (remove_calls === 1) throw new Error('temporary Discord failure')
        },
      },
    }
    const guild = {
      members: {
        cache: { get: () => member },
        fetch: async () => member,
      },
    }

    try {
      ;(prisma.inventoryItem as any).findMany = async () => (handled ? [] : [item])
      ;(prisma.inventoryItem as any).updateMany = async ({ data }: any) => {
        if (data.expiredHandledAt instanceof Date) {
          handled = true
          claimed = false
          return { count: 1 }
        }
        if (data.expirationClaimedAt === null) {
          claimed = false
          return { count: 1 }
        }
        if (data.expirationClaimedAt instanceof Date) {
          if (claimed) return { count: 0 }
          claimed = true
          return { count: 1 }
        }
        return { count: 0 }
      }

      const client = {
        guilds: {
          cache: { get: () => guild },
          fetch: async () => guild,
        },
      }
      const scheduler = new InventoryExpirationScheduler(client as any)

      await (scheduler as any).tick()
      assert.equal(handled, false)
      assert.equal(claimed, false)

      await (scheduler as any).tick()
      assert.equal(handled, true)
      assert.equal(claimed, false)
      assert.equal(remove_calls, 2)
    } finally {
      ;(prisma.inventoryItem as any).findMany = original_find_many
      ;(prisma.inventoryItem as any).updateMany = original_update_many
    }
  })

  await t.test('giveaway finalization persists winners only once for duplicate stale invocations', async () => {
    const original_transaction = (prisma as any).$transaction

    let ended = false
    let winner_writes = 0
    let announcements = 0
    let notifications = 0

    try {
      ;(prisma as any).$transaction = async (operation: (tx: any) => Promise<unknown>) =>
        operation({
          giveaway: {
            updateMany: async () => {
              if (ended) return { count: 0 }
              ended = true
              return { count: 1 }
            },
          },
          giveawayWinner: {
            createMany: async ({ data, skipDuplicates }: any) => {
              winner_writes += 1
              assert.equal(data.length, 1)
              assert.equal(skipDuplicates, true)
              return { count: data.length }
            },
          },
        })

      const scheduler = Object.create(GiveawayScheduler.prototype) as any
      scheduler.client = {}
      scheduler.selectWinnersWithRoleChances = async (_giveaway: unknown, entries: unknown[]) => entries.slice(0, 1)
      scheduler.announceWinners = async () => {
        announcements += 1
      }
      scheduler.notifyWinners = async () => {
        notifications += 1
      }

      const giveaway = {
        id: 'giveaway-1',
        format: 'reaction',
        availableItems: null,
        maxWinners: 1,
        roleChances: null,
        entries: [
          { userId: 'user-1', username: 'User 1', disqualified: false },
        ],
      }

      await scheduler.endGiveaway(giveaway)
      await scheduler.endGiveaway(giveaway)

      assert.equal(winner_writes, 1)
      assert.equal(announcements, 1)
      assert.equal(notifications, 1)
    } finally {
      ;(prisma as any).$transaction = original_transaction
    }
  })
})
