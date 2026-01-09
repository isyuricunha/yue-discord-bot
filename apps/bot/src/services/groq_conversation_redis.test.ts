import test from 'node:test'
import assert from 'node:assert/strict'

import { RedisGroqConversationStore } from './groq_conversation_redis'

test('redis_groq_conversation_store: requires redis url', () => {
  assert.throws(() => new RedisGroqConversationStore({ redis_url: '' }), /REDIS_URL/i)
})
