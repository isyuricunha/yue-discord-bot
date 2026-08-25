import test from 'node:test'
import assert from 'node:assert/strict'
import { discord_delivery_retry_delay_ms, is_terminal_discord_delivery_error } from './discordDeliveryScheduler'

test('durable Discord delivery retry policy', () => {
  assert.equal(discord_delivery_retry_delay_ms(1), 5_000)
  assert.equal(discord_delivery_retry_delay_ms(2), 10_000)
  assert.equal(discord_delivery_retry_delay_ms(20), 300_000)

  assert.equal(is_terminal_discord_delivery_error({ code: 10003 }), true)
  assert.equal(is_terminal_discord_delivery_error({ code: '50007' }), true)
  assert.equal(is_terminal_discord_delivery_error(new Error('temporary network failure')), false)
})
