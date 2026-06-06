import test from 'node:test'
import assert from 'node:assert/strict'

import { AutorolePendingIndex } from './autorole_pending_index'

test('AutorolePendingIndex loads pending members once', async () => {
  let calls = 0
  const index = new AutorolePendingIndex(async () => {
    calls += 1
    return [{ guildId: 'guild-1', userId: 'user-1' }]
  })

  assert.equal(await index.isWaiting('guild-1', 'user-1'), true)
  assert.equal(await index.isWaiting('guild-1', 'user-2'), false)
  assert.equal(calls, 1)
})

test('AutorolePendingIndex preserves writes made during initialization', async () => {
  let resolveLoad: ((value: Array<{ guildId: string; userId: string }>) => void) | undefined
  const index = new AutorolePendingIndex(() => new Promise((resolve) => {
    resolveLoad = resolve
  }))

  const initialization = index.initialize()
  index.mark('guild-1', 'new-user', true)
  index.mark('guild-1', 'removed-user', false)
  resolveLoad?.([{ guildId: 'guild-1', userId: 'removed-user' }])
  await initialization

  assert.equal(await index.isWaiting('guild-1', 'new-user'), true)
  assert.equal(await index.isWaiting('guild-1', 'removed-user'), false)
})

test('AutorolePendingIndex retries after an initialization failure', async () => {
  let calls = 0
  const index = new AutorolePendingIndex(async () => {
    calls += 1
    if (calls === 1) throw new Error('temporary database failure')
    return [{ guildId: 'guild-1', userId: 'user-1' }]
  })

  await assert.rejects(index.initialize(), /temporary database failure/)
  assert.equal(await index.isWaiting('guild-1', 'user-1'), true)
  assert.equal(calls, 2)
})
