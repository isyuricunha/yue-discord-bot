import assert from 'node:assert/strict'
import test from 'node:test'

import { assign_giveaway_prizes } from './giveawayPrizeAssignment.logic'

test('assign_giveaway_prizes: matches choice with quantity suffix and respects preference order', () => {
  const availableItems = ['Key A (x2)', 'Key B']

  const winners = [
    { userId: 'u1', username: 'user1', choices: ['Key A (x2)', 'Key B'] },
    { userId: 'u2', username: 'user2', choices: ['Key B', 'Key A'] },
  ]

  const res = assign_giveaway_prizes({ winners, availableItems })

  assert.deepEqual(
    res.map((r) => ({ userId: r.userId, prize: r.prize, prizeIndex: r.prizeIndex })),
    [
      { userId: 'u1', prize: 'Key A', prizeIndex: 0 },
      { userId: 'u2', prize: 'Key B', prizeIndex: 1 },
    ]
  )
})

test('assign_giveaway_prizes: distributes multiple copies from (x2) to multiple winners', () => {
  const availableItems = ['Key A (x2)']

  const winners = [
    { userId: 'u1', username: 'user1', choices: ['Key A'] },
    { userId: 'u2', username: 'user2', choices: ['Key A'] },
  ]

  const res = assign_giveaway_prizes({ winners, availableItems })

  assert.deepEqual(
    res.map((r) => ({ userId: r.userId, prize: r.prize, prizeIndex: r.prizeIndex })),
    [
      { userId: 'u1', prize: 'Key A', prizeIndex: 0 },
      { userId: 'u2', prize: 'Key A', prizeIndex: 0 },
    ]
  )
})

test('assign_giveaway_prizes: after quantity exhausted, later winner gets null prize', () => {
  const availableItems = ['Key A (x1)']

  const winners = [
    { userId: 'u1', username: 'user1', choices: ['Key A'] },
    { userId: 'u2', username: 'user2', choices: ['Key A'] },
  ]

  const res = assign_giveaway_prizes({ winners, availableItems })

  assert.deepEqual(
    res.map((r) => ({ userId: r.userId, prize: r.prize, prizeIndex: r.prizeIndex })),
    [
      { userId: 'u1', prize: 'Key A', prizeIndex: 0 },
      { userId: 'u2', prize: null, prizeIndex: null },
    ]
  )
})
