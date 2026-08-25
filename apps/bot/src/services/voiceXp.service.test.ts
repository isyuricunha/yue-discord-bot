import test from 'node:test'
import assert from 'node:assert/strict'

import { advance_voice_checkpoint, voice_full_minutes } from './voiceXp.service'

test('voice_full_minutes only awards complete minutes', () => {
  const start = new Date('2026-08-25T12:00:00.000Z')
  assert.equal(voice_full_minutes(start, new Date('2026-08-25T12:00:59.999Z')), 0)
  assert.equal(voice_full_minutes(start, new Date('2026-08-25T12:01:00.000Z')), 1)
  assert.equal(voice_full_minutes(start, new Date('2026-08-25T12:05:42.000Z')), 5)
})

test('advance_voice_checkpoint preserves fractional remainder', () => {
  const start = new Date('2026-08-25T12:00:30.000Z')
  assert.equal(advance_voice_checkpoint(start, 3).toISOString(), '2026-08-25T12:03:30.000Z')
})
