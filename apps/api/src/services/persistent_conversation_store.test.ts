import assert from 'node:assert/strict'
import test from 'node:test'

import { PersistentConversationStore } from './persistent_conversation_store'

type fake_redis_store = Map<string, string>

function fake_redis(store: fake_redis_store) {
  return {
    keys: async (pattern: string) => [...store.keys()].filter((key) => key.startsWith(pattern.slice(0, -1))),
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, _mode: 'EX', _seconds: number) => {
      store.set(key, value)
      return 'OK'
    },
  }
}

const MESSAGES = [
  { role: 'user', content: 'primeira pergunta' },
  { role: 'assistant', content: 'primeira resposta' },
] as const

test('conversations written before a restart are restored by hydrate (audit improvement #5)', async () => {
  const backing = new Map<string, string>()

  const first_process = new PersistentConversationStore(fake_redis(backing) as any, { ttlMs: 30 * 60 * 1000 })
  first_process.set('guild-1:user-1', 3, [...MESSAGES])

  // A brand-new process (same Redis, empty memory) hydrates and serves the
  // conversation that would previously have been lost on restart.
  const second_process = new PersistentConversationStore(fake_redis(backing) as any, { ttlMs: 30 * 60 * 1000 })
  await second_process.hydrate()

  assert.deepEqual(second_process.get('guild-1:user-1', 3), [...MESSAGES])
})

test('hydrated entries still respect the environment version', async () => {
  const backing = new Map<string, string>()

  const first_process = new PersistentConversationStore(fake_redis(backing) as any, { ttlMs: 30 * 60 * 1000 })
  first_process.set('guild-1:user-1', 3, [...MESSAGES])

  const second_process = new PersistentConversationStore(fake_redis(backing) as any, { ttlMs: 30 * 60 * 1000 })
  await second_process.hydrate()

  // A different environment version invalidates the history, exactly like the
  // in-memory store.
  assert.deepEqual(second_process.get('guild-1:user-1', 999), [])
})

test('hydrate without any persisted keys keeps the store empty', async () => {
  const store = new PersistentConversationStore(fake_redis(new Map()) as any, { ttlMs: 30 * 60 * 1000 })
  await store.hydrate()

  assert.deepEqual(store.get('guild-1:user-1', 3), [])
})
