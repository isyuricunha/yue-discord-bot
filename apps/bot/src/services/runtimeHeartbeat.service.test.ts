import test from 'node:test'
import assert from 'node:assert/strict'
import type { Client } from 'discord.js'

import { build_runtime_heartbeat_snapshot } from './runtimeHeartbeat.service'

test('runtime heartbeat snapshot reports Discord and guild activity', () => {
  const client = {
    isReady: () => true,
    guilds: {
      cache: new Map([
        ['guild-1', { memberCount: 10 }],
        ['guild-2', { memberCount: 25 }],
      ]),
    },
  } as unknown as Client

  const snapshot = build_runtime_heartbeat_snapshot(client)

  assert.equal(snapshot.discordReady, true)
  assert.equal(snapshot.guildCount, 2)
  assert.equal(snapshot.userCount, 35)
  assert.equal(Number.isInteger(snapshot.uptimeSeconds), true)
  assert.equal(snapshot.uptimeSeconds >= 0, true)
})
