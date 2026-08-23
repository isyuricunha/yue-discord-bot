import test from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyBaseLogger } from 'fastify'

import {
  can_access_guild,
  request_guild_id,
  verify_live_guild_access,
  type guild_admin_checker,
} from './guild_access'

const log = {} as FastifyBaseLogger

test('request_guild_id extracts a normalized guild id', () => {
  assert.equal(request_guild_id({ guildId: '  guild-1  ' }), 'guild-1')
  assert.equal(request_guild_id({ guildId: '' }), null)
  assert.equal(request_guild_id({}), null)
  assert.equal(request_guild_id(null), null)
})

test('route-level guild claims remain compatible without the global live guard', () => {
  const user = {
    guilds: ['guild-1'],
    isOwner: false,
  }

  assert.equal(can_access_guild(user, 'guild-1'), true)
  assert.equal(can_access_guild(user, 'guild-2'), false)
})

test('live guild authorization ignores stale JWT guild claims', async () => {
  const user = {
    userId: 'user-1',
    guilds: ['guild-1'],
    isOwner: false,
  }

  const check_admin: guild_admin_checker = async () => ({ isAdmin: false })

  assert.equal(await verify_live_guild_access(user, 'guild-1', log, check_admin), false)
  assert.equal(can_access_guild(user, 'guild-1'), false)
})

test('live guild authorization grants newly acquired access for the current request', async () => {
  const user = {
    userId: 'user-1',
    guilds: [],
    isOwner: false,
  }

  const calls: Array<{ guildId: string; userId: string }> = []
  const check_admin: guild_admin_checker = async (guild_id, user_id) => {
    calls.push({ guildId: guild_id, userId: user_id })
    return { isAdmin: true }
  }

  assert.equal(await verify_live_guild_access(user, 'guild-1', log, check_admin), true)
  assert.equal(can_access_guild(user, 'guild-1'), true)
  assert.deepEqual(calls, [{ guildId: 'guild-1', userId: 'user-1' }])
})

test('owner access bypasses the live Discord permission lookup', async () => {
  const user = {
    userId: 'owner-1',
    isOwner: true,
  }

  let called = false
  const check_admin: guild_admin_checker = async () => {
    called = true
    return { isAdmin: false }
  }

  assert.equal(await verify_live_guild_access(user, 'guild-1', log, check_admin), true)
  assert.equal(can_access_guild(user, 'guild-1'), true)
  assert.equal(called, false)
})

test('live guild authorization fails closed when the user id is missing', async () => {
  const user = {
    isOwner: false,
  }

  let called = false
  const check_admin: guild_admin_checker = async () => {
    called = true
    return { isAdmin: true }
  }

  assert.equal(await verify_live_guild_access(user, 'guild-1', log, check_admin), false)
  assert.equal(can_access_guild(user, 'guild-1'), false)
  assert.equal(called, false)
})

test('live guild authorization propagates lookup failures to the API boundary', async () => {
  const user = {
    userId: 'user-1',
    isOwner: false,
  }

  const check_admin: guild_admin_checker = async () => {
    throw new Error('internal bot API unavailable')
  }

  await assert.rejects(
    () => verify_live_guild_access(user, 'guild-1', log, check_admin),
    /internal bot API unavailable/
  )
  assert.equal(can_access_guild(user, 'guild-1'), false)
})
