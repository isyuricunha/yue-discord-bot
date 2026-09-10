import test from 'node:test'
import assert from 'node:assert/strict'

import { prisma } from '@yuebot/database'

import {
  DiscordDeliveryScheduler,
  discord_delivery_retry_delay_ms,
  is_terminal_discord_delivery_error,
} from './discordDeliveryScheduler'

test('durable Discord delivery retry policy', () => {
  assert.equal(discord_delivery_retry_delay_ms(1), 5_000)
  assert.equal(discord_delivery_retry_delay_ms(2), 10_000)
  assert.equal(discord_delivery_retry_delay_ms(20), 300_000)

  assert.equal(is_terminal_discord_delivery_error({ code: 10003 }), true)
  assert.equal(is_terminal_discord_delivery_error({ code: '50007' }), true)
  assert.equal(is_terminal_discord_delivery_error(new Error('temporary network failure')), false)
})

test('stop() waits for an in-flight run_once before resolving (audit finding BOT-007)', async () => {
  let enter_resolve!: () => void
  let release_resolve!: () => void
  const entered = new Promise<void>((resolve) => { enter_resolve = resolve })
  const release = new Promise<void>((resolve) => { release_resolve = resolve })
  let active = false

  const original_find_many = prisma.discordDelivery.findMany
  ;(prisma.discordDelivery as any).findMany = async () => {
    active = true
    enter_resolve()
    await release
    active = false
    return []
  }

  try {
    const scheduler = new DiscordDeliveryScheduler({} as any)
    scheduler.start()
    await entered

    const stop_promise = scheduler.stop()
    assert.equal(active, true, 'run_once should still be in flight right after calling stop()')

    release_resolve()
    await stop_promise

    assert.equal(active, false, 'stop() must not resolve before the in-flight run_once finishes')
  } finally {
    ;(prisma.discordDelivery as any).findMany = original_find_many
  }
})
