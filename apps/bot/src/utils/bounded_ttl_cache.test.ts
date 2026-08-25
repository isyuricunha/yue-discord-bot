import test from 'node:test'
import assert from 'node:assert/strict'

import { BoundedTtlCache } from './bounded_ttl_cache'

test('BoundedTtlCache expires entries', () => {
  const cache = new BoundedTtlCache<string, number>({ ttl_ms: 100, max_entries: 10 })
  cache.set('a', 1, 1_000)
  assert.equal(cache.get('a', 1_099), 1)
  assert.equal(cache.get('a', 1_100), undefined)
})

test('BoundedTtlCache evicts the least recently used entry', () => {
  const cache = new BoundedTtlCache<string, number>({ ttl_ms: 10_000, max_entries: 2 })
  cache.set('a', 1, 1_000)
  cache.set('b', 2, 1_001)
  assert.equal(cache.get('a', 1_002), 1)
  cache.set('c', 3, 1_003)

  assert.equal(cache.get('b', 1_004), undefined)
  assert.equal(cache.get('a', 1_004), 1)
  assert.equal(cache.get('c', 1_004), 3)
  assert.equal(cache.size, 2)
})
