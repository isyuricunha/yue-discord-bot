import test from 'node:test'
import assert from 'node:assert/strict'

import { build_ai_moderation_thresholds } from './automod.ai_thresholds'

test('build_ai_moderation_thresholds: returns defaults for level', () => {
  const { thresholds, applied_overrides } = build_ai_moderation_thresholds('medio', null)
  assert.equal(applied_overrides && Object.keys(applied_overrides).length, 0)
  assert.equal(thresholds['harassment'], 0.75)
  assert.equal(thresholds['sexual/minors'], 0.75)
})

test('build_ai_moderation_thresholds: applies only known categories and clamps values', () => {
  const { thresholds, applied_overrides } = build_ai_moderation_thresholds('medio', {
    harassment: 0.9,
    'sexual/minors': 2,
    unknown: 0.1,
  })

  assert.equal(thresholds['harassment'], 0.9)
  assert.equal(thresholds['sexual/minors'], 1)
  assert.equal((thresholds as any).unknown, undefined)

  assert.deepEqual(applied_overrides, {
    harassment: 0.9,
    'sexual/minors': 1,
  })
})
