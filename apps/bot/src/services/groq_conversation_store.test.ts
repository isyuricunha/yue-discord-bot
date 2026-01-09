import test from 'node:test'
import assert from 'node:assert/strict'

import { GroqConversationStore } from './groq_conversation_store'

test('groq_conversation_store: appends and truncates', async () => {
  const store = new GroqConversationStore({ ttl_seconds: 999, max_messages: 3, max_message_chars: 100 })
  const key = 'k'

  await store.append(key, { role: 'user', content: 'a' })
  await store.append(key, { role: 'assistant', content: 'b' })
  await store.append(key, { role: 'user', content: 'c' })
  await store.append(key, { role: 'assistant', content: 'd' })

  const history = await store.get_history(key)
  assert.deepEqual(history.map((m) => m.content), ['b', 'c', 'd'])
})

test('groq_conversation_store: trims long content', async () => {
  const store = new GroqConversationStore({ ttl_seconds: 999, max_messages: 10, max_message_chars: 5 })
  const key = 'k'

  await store.append(key, { role: 'user', content: '   123456789   ' })
  const history = await store.get_history(key)
  assert.equal(history[0]?.content, '12345…')
})
