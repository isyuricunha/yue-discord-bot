import test from 'node:test'
import assert from 'node:assert/strict'

import {
  get_suggestion_timeframe_start_date,
  is_suggestion_timeframe,
  parse_suggestion_timeframe,
  suggestion_timeframe_label,
} from '../suggestion_timeframes'

test('is_suggestion_timeframe: validates allowed timeframe tokens', () => {
  assert.equal(is_suggestion_timeframe('30d'), true)
  assert.equal(is_suggestion_timeframe('60d'), true)
  assert.equal(is_suggestion_timeframe('3m'), true)
  assert.equal(is_suggestion_timeframe('6m'), true)

  assert.equal(is_suggestion_timeframe('7d'), false)
  assert.equal(is_suggestion_timeframe(''), false)
  assert.equal(is_suggestion_timeframe(null), false)
})

test('parse_suggestion_timeframe: returns timeframe or null', () => {
  assert.equal(parse_suggestion_timeframe('30d'), '30d')
  assert.equal(parse_suggestion_timeframe('nope'), null)
})

test('get_suggestion_timeframe_start_date: supports day-based timeframes', () => {
  const now = new Date('2026-01-10T12:00:00.000Z')

  const start_30d = get_suggestion_timeframe_start_date('30d', now)
  assert.equal(start_30d.toISOString(), '2025-12-11T12:00:00.000Z')

  const start_60d = get_suggestion_timeframe_start_date('60d', now)
  assert.equal(start_60d.toISOString(), '2025-11-11T12:00:00.000Z')
})

test('get_suggestion_timeframe_start_date: clamps month subtraction for end-of-month dates', () => {
  const now = new Date('2026-03-31T10:00:00.000Z')

  const start_3m = get_suggestion_timeframe_start_date('3m', now)
  assert.equal(start_3m.toISOString(), '2025-12-31T10:00:00.000Z')

  const start_6m = get_suggestion_timeframe_start_date('6m', now)
  assert.equal(start_6m.toISOString(), '2025-09-30T10:00:00.000Z')
})

test('suggestion_timeframe_label: returns human label', () => {
  assert.equal(suggestion_timeframe_label('30d'), 'Últimos 30 dias')
  assert.equal(suggestion_timeframe_label('6m'), 'Últimos 6 meses')
})
