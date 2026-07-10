import test from 'node:test'
import assert from 'node:assert/strict'

import { RedisConversationStore } from './conversation_redis'

test('redis_conversation_store: requires redis url', () => {
  assert.throws(() => new RedisConversationStore({ redis_url: '' }), /REDIS_URL/i)
})
