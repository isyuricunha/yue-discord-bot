import assert from 'node:assert/strict'
import test from 'node:test'

import { ConversationStore, DEFAULT_TTL_MS, DEFAULT_MAX_HISTORY_MESSAGES } from './conversation_store'
import type { panel_ai_message } from './panel_ai'

function make_message(role: 'user' | 'assistant', content: string): panel_ai_message {
  return { role, content }
}

test('isolates history by user within the same guild', () => {
  const store = new ConversationStore()
  store.set('guild-1:user-A', 1, [make_message('user', 'hi A'), make_message('assistant', 'hello A')])
  store.set('guild-1:user-B', 1, [make_message('user', 'hi B'), make_message('assistant', 'hello B')])

  const a = store.get('guild-1:user-A', 1)
  const b = store.get('guild-1:user-B', 1)

  assert.equal(a[0].content, 'hi A')
  assert.equal(b[0].content, 'hi B')
})

test('isolates history by guild for the same user', () => {
  const store = new ConversationStore()
  store.set('guild-1:user-X', 1, [make_message('user', 'guild 1')])
  store.set('guild-2:user-X', 1, [make_message('user', 'guild 2')])

  assert.equal(store.get('guild-1:user-X', 1)[0].content, 'guild 1')
  assert.equal(store.get('guild-2:user-X', 1)[0].content, 'guild 2')
})

test('returns empty when the entry has expired', () => {
  const store = new ConversationStore({ ttlMs: -1000 })
  store.set('guild-1:user-X', 1, [make_message('user', 'old')])
  assert.equal(store.get('guild-1:user-X', 1).length, 0)
})

test('clears history for a specific guild+user only', () => {
  const store = new ConversationStore()
  store.set('guild-1:user-A', 1, [make_message('user', 'A')])
  store.set('guild-1:user-B', 1, [make_message('user', 'B')])
  store.set('guild-2:user-A', 1, [make_message('user', 'C')])

  store.delete('guild-1:user-A')

  assert.equal(store.get('guild-1:user-A', 1).length, 0)
  assert.equal(store.get('guild-1:user-B', 1)[0].content, 'B')
  assert.equal(store.get('guild-2:user-A', 1)[0].content, 'C')
})

test('delete is idempotent when key does not exist', () => {
  const store = new ConversationStore()
  store.delete('guild-1:nonexistent')
  assert.equal(store.get('guild-1:nonexistent', 1).length, 0)
})

test('enforces max history messages limit internally', () => {
  const store = new ConversationStore({ maxHistoryMessages: 4 })
  const messages: panel_ai_message[] = []
  for (let i = 0; i < 10; i++) {
    messages.push(make_message('user', `msg-${i}`))
    messages.push(make_message('assistant', `reply-${i}`))
  }
  store.set('guild-1:user-A', 1, messages)

  assert.equal(store.get('guild-1:user-A', 1).length, 4)
})

test('history stores only natural user/assistant messages', () => {
  const store = new ConversationStore()
  store.set('guild-1:user-A', 1, [
    make_message('user', 'ta de boa?'),
    make_message('assistant', 'tudo certo!'),
  ])

  const entry = store.get('guild-1:user-A', 1)
  for (const msg of entry) {
    assert.ok(msg.role === 'user' || msg.role === 'assistant', 'only natural roles allowed')
    assert.ok(!msg.content.includes('Panel context:'), 'no context prefix in stored messages')
    assert.ok(!msg.content.includes('<PANEL_CONTEXT>'), 'no structured context in stored messages')
  }
})

test('get returns a copy, not the same reference', () => {
  const store = new ConversationStore()
  const original: panel_ai_message[] = [make_message('user', 'hello')]
  store.set('guild-1:user-A', 1, original)

  original.push(make_message('user', 'mutated'))
  const entry = store.get('guild-1:user-A', 1)
  assert.equal(entry.length, 1, 'stored array must not reflect external push')

  entry.push(make_message('user', 'also mutated'))
  const entry_again = store.get('guild-1:user-A', 1)
  assert.equal(entry_again.length, 1, 'get must always return a fresh copy')
})

test('conversation version invalidates stale history', () => {
  const store = new ConversationStore()
  store.set('guild-1:user-A', 1, [make_message('user', 'v1')])

  assert.equal(store.get('guild-1:user-A', 1)[0].content, 'v1')
  assert.equal(store.get('guild-1:user-A', 2).length, 0, 'version mismatch returns empty')
})

test('prunes expired entries and limits total entries', () => {
  const store = new ConversationStore({ maxEntries: 3 })
  store.set('g1:u1', 1, [make_message('user', 'a')])
  store.set('g2:u2', 1, [make_message('user', 'b')])
  store.set('g3:u3', 1, [make_message('user', 'c')])
  store.set('g4:u4', 1, [make_message('user', 'd')])

  // g1 is evicted because maxEntries=3 and it was the oldest insertion.
  // g2, g3, g4 remain.
  assert.equal(store.get('g1:u1', 1).length, 0, 'oldest entry evicted to stay under maxEntries')
  assert.equal(store.get('g2:u2', 1)[0].content, 'b')
  assert.equal(store.get('g3:u3', 1)[0].content, 'c')
  assert.equal(store.get('g4:u4', 1)[0].content, 'd')
})

test('prunes expired entries on set and on get', async () => {
  const store = new ConversationStore({ ttlMs: 50 })
  store.set('g1:u1', 1, [make_message('user', 'a')])

  // Immediately available
  assert.equal(store.get('g1:u1', 1).length, 1)

  // After expiry, get returns empty and removes the entry as a side effect.
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(store.get('g1:u1', 1).length, 0, 'expired entry returns empty on get')
})

test('uses sane defaults for TTL and max history', () => {
  const store = new ConversationStore()
  store.set('g1:u1', 1, [make_message('user', 'a')])
  const entry = store.get('g1:u1', 1)
  assert.equal(entry.length, 1)
  assert.equal(DEFAULT_TTL_MS, 30 * 60 * 1000)
  assert.equal(DEFAULT_MAX_HISTORY_MESSAGES, 12)
})
