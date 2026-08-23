import test from 'node:test'
import assert from 'node:assert/strict'

import { RecentConversationActivity } from './recent_conversation_activity'

test('recent conversation activity expires without extending TTL on reads', () => {
  const activity = new RecentConversationActivity({ ttl_seconds: 2, max_entries: 10 })

  activity.touch('a', 1_000)

  assert.equal(activity.get_last_activity_ms('a', 2_000), 1_000)
  assert.equal(activity.get_last_activity_ms('a', 3_001), null)
  assert.equal(activity.size, 0)
})

test('recent conversation activity evicts the least recently used key', () => {
  const activity = new RecentConversationActivity({ ttl_seconds: 60, max_entries: 2 })

  activity.touch('a', 1_000)
  activity.touch('b', 1_100)

  assert.equal(activity.get_last_activity_ms('a', 1_200), 1_000)

  activity.touch('c', 1_300)

  assert.equal(activity.get_last_activity_ms('b', 1_400), null)
  assert.equal(activity.get_last_activity_ms('a', 1_400), 1_000)
  assert.equal(activity.get_last_activity_ms('c', 1_400), 1_300)
})

test('recent conversation activity touch renews the continuation timestamp', () => {
  const activity = new RecentConversationActivity({ ttl_seconds: 2, max_entries: 10 })

  activity.touch('a', 1_000)
  activity.touch('a', 2_500)

  assert.equal(activity.get_last_activity_ms('a', 4_000), 2_500)
})

test('recent conversation activity can be cleared explicitly', () => {
  const activity = new RecentConversationActivity({ ttl_seconds: 60, max_entries: 10 })

  activity.touch('a', 1_000)
  activity.clear('a')

  assert.equal(activity.get_last_activity_ms('a', 1_100), null)
})
