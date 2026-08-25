import test from 'node:test'
import assert from 'node:assert/strict'
import type { Client } from 'discord.js'

import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { FreeGameScheduler } from './freeGameScheduler'
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

test('failed free-game sends are not reported as notifications', async (t) => {
  const giveawayDelegate = prisma.freeGameGiveaway as any
  const notificationDelegate = prisma.freeGameNotification as any
  const gamerPower = gamerPowerService as any
  const testLogger = logger as any

  const originals = {
    getAllGiveaways: gamerPower.getAllGiveaways,
    findMany: giveawayDelegate.findMany,
    create: giveawayDelegate.create,
    update: notificationDelegate.update,
    info: testLogger.info,
    error: testLogger.error,
  }

  t.after(() => {
    gamerPower.getAllGiveaways = originals.getAllGiveaways
    giveawayDelegate.findMany = originals.findMany
    giveawayDelegate.create = originals.create
    notificationDelegate.update = originals.update
    testLogger.info = originals.info
    testLogger.error = originals.error
  })

  gamerPower.getAllGiveaways = async () => [make_giveaway(1), make_giveaway(2), make_giveaway(3)]
  giveawayDelegate.findMany = async () => []

  let recordedGiveaways = 0
  giveawayDelegate.create = async () => {
    recordedGiveaways += 1
    return {}
  }

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
          throw Object.assign(new Error('Missing Permissions'), { code: 50013 })
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
    }) => Promise<void>
  }).processGuild.bind(scheduler)

  await processGuild({
    guildId: 'guild-1',
    channelId: 'channel-1',
    roleIds: [],
    platforms: [],
    giveawayTypes: [],
  })

  assert.equal(sendAttempts, 3)
  assert.equal(recordedGiveaways, 0, 'failed sends must remain eligible for a later retry')
  assert.equal(lastCheckedUpdates, 1)
  assert.equal(completionLogs.length, 1)
  assert.deepEqual(completionLogs[0]?.object, {
    guildId: 'guild-1',
    attemptedCount: 3,
    notifiedCount: 0,
  })
})


test('free-game scheduler fetches the GamerPower catalog once for multiple guilds', async () => {
  const original_configs = (prisma.freeGameNotification as any).findMany
  const original_get_all = (gamerPowerService as any).getAllGiveaways
  const original_debug = (logger as any).debug
  const original_info = (logger as any).info

  let catalog_calls = 0
  try {
    ;(logger as any).debug = () => undefined
    ;(logger as any).info = () => undefined

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
  }
})
