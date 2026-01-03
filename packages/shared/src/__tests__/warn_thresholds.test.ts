import test from 'node:test'
import assert from 'node:assert/strict'

import { find_triggered_warn_threshold } from '../warn_thresholds'

test('warn thresholds: returns null when not matched', () => {
  const thresholds = [
    { warns: 2, action: 'mute', duration: '5m' },
    { warns: 3, action: 'mute', duration: '1h' },
  ] as const

  assert.equal(find_triggered_warn_threshold(thresholds as any, 1), null)
  assert.equal(find_triggered_warn_threshold(thresholds as any, 4), null)
})

test('warn thresholds: returns threshold when matched', () => {
  const thresholds = [
    { warns: 2, action: 'mute', duration: '5m' },
    { warns: 3, action: 'ban' },
  ] as const

  assert.deepEqual(find_triggered_warn_threshold(thresholds as any, 2), thresholds[0])
  assert.deepEqual(find_triggered_warn_threshold(thresholds as any, 3), thresholds[1])
})
