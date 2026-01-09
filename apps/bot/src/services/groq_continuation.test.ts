import test from 'node:test'
import assert from 'node:assert/strict'

import { is_within_continuation_window } from './groq_continuation'

test('continuation: 0 seconds disables time continuation', () => {
  const now = 1_000_000
  assert.equal(
    is_within_continuation_window({ now_ms: now, last_activity_ms: now - 1_000, continuation_seconds: 0 }),
    false
  )
})

test('continuation: allows messages within the window', () => {
  const now = 1_000_000
  assert.equal(
    is_within_continuation_window({ now_ms: now, last_activity_ms: now - 1_000, continuation_seconds: 120 }),
    true
  )
})

test('continuation: rejects messages outside the window', () => {
  const now = 1_000_000
  assert.equal(
    is_within_continuation_window({ now_ms: now, last_activity_ms: now - 6_000, continuation_seconds: 5 }),
    false
  )
})

test('continuation: clamps negative values to disabled', () => {
  const now = 1_000_000
  assert.equal(
    is_within_continuation_window({ now_ms: now, last_activity_ms: now - 1_000, continuation_seconds: -10 }),
    false
  )
})
