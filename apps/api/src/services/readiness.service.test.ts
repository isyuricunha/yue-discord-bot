import test from 'node:test'
import assert from 'node:assert/strict'

import { get_readiness } from './readiness.service'

const fixed_now = () => new Date('2026-08-23T19:00:00.000Z')
const ok = async () => {}

test('readiness is ready when database and bot checks pass', async () => {
  const result = await get_readiness({
    bot_enabled: true,
    check_database: ok,
    check_bot_internal_api: ok,
    check_bot_client_ready: ok,
    now: fixed_now,
  })

  assert.deepEqual(result, {
    status: 'ready',
    checks: {
      api: 'ok',
      database: 'ok',
      botInternalApi: 'ok',
      botClient: 'ready',
    },
    timestamp: '2026-08-23T19:00:00.000Z',
  })
})

test('readiness fails closed when the database is unavailable', async () => {
  const result = await get_readiness({
    bot_enabled: true,
    check_database: async () => { throw new Error('database down') },
    check_bot_internal_api: ok,
    check_bot_client_ready: ok,
    now: fixed_now,
  })

  assert.equal(result.status, 'not_ready')
  assert.equal(result.checks.database, 'failed')
  assert.equal(result.checks.botInternalApi, 'ok')
  assert.equal(result.checks.botClient, 'ready')
})

test('readiness distinguishes internal API failure from Discord client failure', async () => {
  const internal_down = await get_readiness({
    bot_enabled: true,
    check_database: ok,
    check_bot_internal_api: async () => { throw new Error('internal API down') },
    check_bot_client_ready: ok,
    now: fixed_now,
  })

  assert.equal(internal_down.status, 'not_ready')
  assert.equal(internal_down.checks.botInternalApi, 'failed')
  assert.equal(internal_down.checks.botClient, 'ready')

  const discord_down = await get_readiness({
    bot_enabled: true,
    check_database: ok,
    check_bot_internal_api: ok,
    check_bot_client_ready: async () => { throw new Error('Discord disconnected') },
    now: fixed_now,
  })

  assert.equal(discord_down.status, 'not_ready')
  assert.equal(discord_down.checks.botInternalApi, 'ok')
  assert.equal(discord_down.checks.botClient, 'not_ready')
})

test('readiness skips bot checks when ENABLE_BOT is disabled', async () => {
  let bot_calls = 0

  const result = await get_readiness({
    bot_enabled: false,
    check_database: ok,
    check_bot_internal_api: async () => { bot_calls += 1 },
    check_bot_client_ready: async () => { bot_calls += 1 },
    now: fixed_now,
  })

  assert.equal(bot_calls, 0)
  assert.deepEqual(result.checks, {
    api: 'ok',
    database: 'ok',
    botInternalApi: 'disabled',
    botClient: 'disabled',
  })
  assert.equal(result.status, 'ready')
})
