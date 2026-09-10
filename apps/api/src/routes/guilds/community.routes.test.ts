import assert from 'node:assert/strict'
import test from 'node:test'

import { sort_suggestions_by_net_score } from './community.routes'

test('sort_suggestions_by_net_score keeps the best net score even at a tight limit (audit finding API-002)', () => {
  const rows = [
    { id: 'A', upvotes: 10, downvotes: 10, createdAt: new Date('2026-01-02') },
    { id: 'B', upvotes: 9, downvotes: 0, createdAt: new Date('2026-01-01') },
  ]

  // A previously sorted higher by raw upvotes and could evict B from a
  // database-side `take: 1`, even though B has the better net score (9 vs 0).
  const top_one = sort_suggestions_by_net_score(rows, 1)
  assert.equal(top_one.length, 1)
  assert.equal(top_one[0]?.id, 'B')

  const top_two = sort_suggestions_by_net_score(rows, 2)
  assert.deepEqual(top_two.map((row) => row.id), ['B', 'A'])
})

test('sort_suggestions_by_net_score breaks ties by upvotes, then recency, then id', () => {
  const rows = [
    { id: 'tie-newer', upvotes: 5, downvotes: 2, createdAt: new Date('2026-02-01') },
    { id: 'tie-older', upvotes: 5, downvotes: 2, createdAt: new Date('2026-01-01') },
    { id: 'lower-score', upvotes: 1, downvotes: 1, createdAt: new Date('2026-03-01') },
  ]

  const sorted = sort_suggestions_by_net_score(rows, 3)
  assert.deepEqual(sorted.map((row) => row.id), ['tie-newer', 'tie-older', 'lower-score'])
})
