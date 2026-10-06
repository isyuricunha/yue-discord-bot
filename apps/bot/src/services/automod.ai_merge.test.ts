import test from 'node:test'
import assert from 'node:assert/strict'

import { merge_moderation_results } from './automod.ai_merge'

test('merge_moderation_results: unions triggered categories and keeps highest scores', () => {
  const merged = merge_moderation_results([
    { ok: true, flagged: true, triggeredCategories: ['hate'], scores: { hate: 0.8, sexual: 0.4 } },
    { ok: true, flagged: false, triggeredCategories: [], scores: { sexual: 0.9 } },
  ])

  assert.equal(merged.ok, true)
  assert.equal(merged.flagged, true)
  assert.deepEqual(merged.triggeredCategories, ['hate'])
  assert.equal(merged.scores.hate, 0.8)
  assert.equal(merged.scores.sexual, 0.9)
})

test('merge_moderation_results: ignores null parts and non-numeric scores', () => {
  const merged = merge_moderation_results([
    null,
    { ok: false, flagged: false, triggeredCategories: [], scores: { hate: Number.NaN } },
  ])

  assert.equal(merged.ok, false)
  assert.equal(merged.flagged, false)
  assert.deepEqual(merged.triggeredCategories, [])
  assert.deepEqual(merged.scores, {})
})

test('merge_moderation_results: fallback result can flag after primary failure', () => {
  const merged = merge_moderation_results([
    { ok: false, flagged: false, triggeredCategories: [], scores: {} },
    null,
    { ok: true, flagged: true, triggeredCategories: ['self-harm'], scores: { 'self-harm': 0.9 } },
  ])

  assert.equal(merged.ok, true)
  assert.equal(merged.flagged, true)
  assert.deepEqual(merged.triggeredCategories, ['self-harm'])
})

test('merge_moderation_results: empty input stays non-flagged', () => {
  const merged = merge_moderation_results([])
  assert.equal(merged.ok, false)
  assert.equal(merged.flagged, false)
})
