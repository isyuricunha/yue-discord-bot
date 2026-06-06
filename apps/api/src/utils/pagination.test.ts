import test from 'node:test'
import assert from 'node:assert/strict'

import { parse_pagination_query, parse_query_integer } from './pagination'

test('parse_pagination_query falls back for invalid values and clamps offset', () => {
  assert.deepEqual(
    parse_pagination_query({ limit: 'abc', offset: '-10' }, { defaultLimit: 25, maxLimit: 100 }),
    { limit: 25, offset: 0 }
  )
})

test('parse_pagination_query clamps limits to the configured range', () => {
  assert.deepEqual(
    parse_pagination_query({ limit: '500', offset: '12' }, { defaultLimit: 25, maxLimit: 100 }),
    { limit: 100, offset: 12 }
  )

  assert.deepEqual(
    parse_pagination_query({ limit: '0', offset: '0' }, { defaultLimit: 25, maxLimit: 100 }),
    { limit: 1, offset: 0 }
  )
})

test('parse_query_integer rejects decimals and unsafe values', () => {
  assert.equal(parse_query_integer('10.5', { fallback: 7, min: 1, max: 100 }), 7)
  assert.equal(parse_query_integer('9007199254740992', { fallback: 7, min: 1, max: 100 }), 7)
})

test('parse_query_integer uses the first value for repeated query params', () => {
  assert.equal(parse_query_integer(['40', '80'], { fallback: 7, min: 1, max: 100 }), 40)
})
