import test from 'node:test'
import assert from 'node:assert/strict'
import type { Client } from 'discord.js'

import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { FreeGameScheduler, matchesGuildGiveawayFilters } from './freeGameScheduler'
import { gamerPowerService, type GamerPowerGiveaway } from './gamerpower.service'

function make_giveaway(id: number): GamerPowerGiveaway {
  return {
    id,
    title: `Giveaway ${id}`,
    worth: '$9.99',
    thumbnail: '',
    image: '',
    description: 'Free game',
    instructions: 'Claim it',
    platforms: ['steam'],
    type: 'game',
    end_date: '2026-08-31',
    users: 1,
    status: 'active',
    gamerpower_url: `https://www.gamerpower.com/open/giveaway-${id}`,
    published_at: '2026-08-24T00:00:00Z',
  }
}

function make_runtime_giveaway(
  id: number,
  platforms: string,
  type = 'Game',
): GamerPowerGiveaway {
  return {
    ...make_giveaway(id),
    platforms,
    type,
  } as unknown as GamerPowerGiveaway
}

test('free-game filters normalize GamerPower human-readable platforms and type casing', () => {
  assert.equal(
    matchesGuildGiveawayFilters(
      make_runtime_giveaway(1, 'PC, Epic Games Store'),
      { platforms: ['epic-games-store'], giveawayTypes: ['game'] },
    ),
    true,
  )

  assert.equal(
    matchesGuildGiveawayFilters(
      make_runtime_giveaway(2, 'PC, Xbox Series X/S'),
      { platforms: ['xbox-series-xs'], giveawayTypes: ['game'] },
    ),
    true,
  )

  assert.equal(
    matchesGuildGiveawayFilters(
      make_runtime_giveaway(3, 'PC, itch.io'),
      { platforms: ['itch.io'], giveawayTypes: ['game'] },
    ),
    true,
  )

  assert.equal(
    matchesGuildGiveawayFilters(
      make_runtime_giveaway(4, 'PC, Epic Games Store'),
      { platforms: ['steam'], giveawayTypes: ['game'] },
    ),
    false,
  )
})

test('free-game notifications reserve durable deliveries before Discord I/O', async (t) => {
  const giveawayDelegate = prisma.freeGameGiveaway as any
  const notificationDelegate = prisma.freeGameNotification as any
  const deliveryDelegate = prisma.discordDelivery as any
  const prismaClient = prisma as any
  const gamerPower = gamerPowerService as any
  const testLogger = logger as any

  const originals = {
    getAllGiveaways: gamerPower.getAllGiveaways,
    giveawayFindMany: giveawayDelegate.findMany,
    deliveryFindMany: deliveryDelegate.findMany,
    transaction: prismaClient.$transaction,
    update: notificationDelegate.update,
    info: testLogger.info,
    error: testLogger.error,
  }

  t.after(() => {
    gamerPower.getAllGiveaways = originals.getAllGiveaways
    giveawayDelegate.findMany = originals.giveawayFindMany
    deliveryDelegate.findMany = originals.deliveryFindMany
    prismaClient.$transaction = originals.transaction
    notificationDelegate.update = originals.update
    testLogger.info = originals.info
    testLogger.error = originals.error
  })

  gamerPower.getAllGiveaways = async () => [make_giveaway(1), make_giveaway(2), make_giveaway(3)]
  giveawayDelegate.findMany = async () => []
  deliveryDelegate.findMany = async () => []

  let reservedGiveaways = 0
  const deliveries: Array<{ dedupeKey: string; kind: string }> = []
  prismaClient.$transaction = async (operation: (tx: any) => Promise<unknown>) =>
    operation({
      freeGameGiveaway: {
        createMany: async ({ data, skipDuplicates }: any) => {
          assert.equal(skipDuplicates, true)
          assert.equal(data.length, 1)
          reservedGiveaways += 1
          return { count: 1 }
        },
      },
      discordDelivery: {
        upsert: async ({ where, create }: any) => {
          assert.equal(where.dedupeKey, create.dedupeKey)
          deliveries.push({ dedupeKey: create.dedupeKey, kind: create.kind })
          return create
        },
        updateMany: async () => ({ count: 0 }),
      },
    })

  let lastCheckedUpdates = 0
  notificationDelegate.update = async () => {
    lastCheckedUpdates += 1
    return {}
  }

  const completionLogs: Array<{ object: Record<string, unknown>; message: string }> = []
  testLogger.info = (object: Record<string, unknown>, message: string) => {
    if (message === 'Verificação de jogos grátis concluída') {
      completionLogs.push({ object, message })
    }
  }
  testLogger.error = () => {}

  let sendAttempts = 0
  const client = {
    channels: {
      fetch: async () => ({
        id: 'channel-1',
        send: async () => {
          sendAttempts += 1
          return {}
        },
      }),
    },
  } as unknown as Client

  const scheduler = new FreeGameScheduler(client)
  const processGuild = (scheduler as unknown as {
    processGuild: (config: {
      guildId: string
      channelId: string
      roleIds: string[]
      platforms: string[]
      giveawayTypes: string[]
    }) => Promise<Record<string, number>>
  }).processGuild.bind(scheduler)

  await processGuild({
    guildId: 'guild-1',
    channelId: 'channel-1',
    roleIds: [],
    platforms: [],
    giveawayTypes: [],
  })

  assert.equal(sendAttempts, 0, 'reservation phase must not perform Discord I/O')
  assert.equal(reservedGiveaways, 3)
  assert.equal(deliveries.length, 3)
  assert.deepEqual(deliveries.map((delivery) => delivery.kind), [
    'free_game_announcement',
    'free_game_announcement',
    'free_game_announcement',
  ])
  assert.equal(new Set(deliveries.map((delivery) => delivery.dedupeKey)).size, 3)
  assert.equal(lastCheckedUpdates, 1)
  assert.equal(completionLogs.length, 1)
  assert.deepEqual(completionLogs[0]?.object, {
    guildId: 'guild-1',
    catalogCount: 3,
    matchedCount: 3,
    newCount: 3,
    queuedCount: 3,
    reopenedCount: 0,
    pendingCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    legacyAnnouncedCount: 0,
  })
})

test('free-game scheduler reopens an old failed durable delivery without reserving it again', async (t) => {
  const giveawayDelegate = prisma.freeGameGiveaway as any
  const notificationDelegate = prisma.freeGameNotification as any
  const deliveryDelegate = prisma.discordDelivery as any
  const prismaClient = prisma as any
  const testLogger = logger as any

  const originals = {
    giveawayFindMany: giveawayDelegate.findMany,
    deliveryFindMany: deliveryDelegate.findMany,
    transaction: prismaClient.$transaction,
    update: notificationDelegate.update,
    info: testLogger.info,
    error: testLogger.error,
  }

  t.after(() => {
    giveawayDelegate.findMany = originals.giveawayFindMany
    deliveryDelegate.findMany = originals.deliveryFindMany
    prismaClient.$transaction = originals.transaction
    notificationDelegate.update = originals.update
    testLogger.info = originals.info
    testLogger.error = originals.error
  })

  const giveaway = make_runtime_giveaway(77, 'PC, Epic Games Store')
  giveawayDelegate.findMany = async () => [{ giveawayId: '77' }]
  deliveryDelegate.findMany = async () => [{
    dedupeKey: 'free-game:guild-1:77',
    deliveredAt: null,
    failedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  }]

  let reservationAttempts = 0
  let reopenWhere: any = null
  let reopenData: any = null
  prismaClient.$transaction = async (operation: (tx: any) => Promise<unknown>) =>
    operation({
      freeGameGiveaway: {
        createMany: async () => {
          reservationAttempts += 1
          return { count: 0 }
        },
      },
      discordDelivery: {
        upsert: async () => ({}),
        updateMany: async ({ where, data }: any) => {
          reopenWhere = where
          reopenData = data
          return { count: 1 }
        },
      },
    })

  notificationDelegate.update = async () => ({})
  testLogger.info = () => {}
  testLogger.error = () => {}

  const scheduler = new FreeGameScheduler({} as Client)
  const summary = await (scheduler as any).processGuild(
    {
      guildId: 'guild-1',
      channelId: 'channel-new',
      roleIds: [],
      platforms: ['epic-games-store'],
      giveawayTypes: ['game'],
    },
    [giveaway],
  )

  assert.equal(reservationAttempts, 0)
  assert.deepEqual(reopenWhere, {
    dedupeKey: 'free-game:guild-1:77',
    deliveredAt: null,
    failedAt: { not: null },
  })
  assert.equal(reopenData.channelId, 'channel-new')
  assert.equal(reopenData.failedAt, null)
  assert.equal(reopenData.claimedAt, null)
  assert.equal(reopenData.attempts, 0)
  assert.equal(reopenData.lastError, null)
  assert.deepEqual(summary, {
    catalogCount: 1,
    matchedCount: 1,
    newCount: 0,
    queuedCount: 0,
    reopenedCount: 1,
    pendingCount: 0,
    deliveredCount: 0,
    failedCount: 1,
    legacyAnnouncedCount: 0,
  })
})

test('free-game scheduler never reopens an already delivered announcement', async (t) => {
  const giveawayDelegate = prisma.freeGameGiveaway as any
  const notificationDelegate = prisma.freeGameNotification as any
  const deliveryDelegate = prisma.discordDelivery as any
  const prismaClient = prisma as any
  const testLogger = logger as any

  const originals = {
    giveawayFindMany: giveawayDelegate.findMany,
    deliveryFindMany: deliveryDelegate.findMany,
    transaction: prismaClient.$transaction,
    update: notificationDelegate.update,
    info: testLogger.info,
    error: testLogger.error,
  }

  t.after(() => {
    giveawayDelegate.findMany = originals.giveawayFindMany
    deliveryDelegate.findMany = originals.deliveryFindMany
    prismaClient.$transaction = originals.transaction
    notificationDelegate.update = originals.update
    testLogger.info = originals.info
    testLogger.error = originals.error
  })

  const giveaway = make_giveaway(88)
  giveawayDelegate.findMany = async () => [{ giveawayId: '88' }]
  deliveryDelegate.findMany = async () => [{
    dedupeKey: 'free-game:guild-1:88',
    deliveredAt: new Date(),
    failedAt: null,
  }]

  let transactions = 0
  prismaClient.$transaction = async () => {
    transactions += 1
    return undefined
  }
  notificationDelegate.update = async () => ({})
  testLogger.info = () => {}
  testLogger.error = () => {}

  const scheduler = new FreeGameScheduler({} as Client)
  const summary = await (scheduler as any).processGuild(
    {
      guildId: 'guild-1',
      channelId: 'channel-1',
      roleIds: [],
      platforms: ['steam'],
      giveawayTypes: ['game'],
    },
    [giveaway],
  )

  assert.equal(transactions, 0)
  assert.equal(summary.deliveredCount, 1)
  assert.equal(summary.reopenedCount, 0)
  assert.equal(summary.queuedCount, 0)
})

test('free-game scheduler fetches the GamerPower catalog once for multiple guilds', async () => {
  const original_configs = (prisma.freeGameNotification as any).findMany
  const original_get_all = (gamerPowerService as any).getAllGiveaways
  const original_debug = (logger as any).debug
  const original_info = (logger as any).info
  const original_warn = (logger as any).warn

  let catalog_calls = 0
  try {
    ;(logger as any).debug = () => undefined
    ;(logger as any).info = () => undefined
    ;(logger as any).warn = () => undefined

    ;(prisma.freeGameNotification as any).findMany = async () => [
      {
        guildId: 'guild-1',
        channelId: 'channel-1',
        roleIds: [],
        platforms: [],
        giveawayTypes: [],
      },
      {
        guildId: 'guild-2',
        channelId: 'channel-2',
        roleIds: [],
        platforms: ['steam'],
        giveawayTypes: ['game'],
      },
    ]

    ;(gamerPowerService as any).getAllGiveaways = async () => {
      catalog_calls += 1
      return []
    }

    const scheduler = new FreeGameScheduler({} as any)
    await (scheduler as any).processGuildNotifications()

    assert.equal(catalog_calls, 1)
  } finally {
    ;(prisma.freeGameNotification as any).findMany = original_configs
    ;(gamerPowerService as any).getAllGiveaways = original_get_all
    ;(logger as any).debug = original_debug
    ;(logger as any).info = original_info
    ;(logger as any).warn = original_warn
  }
})
