import assert from 'node:assert/strict'
import test from 'node:test'

import { PanelConversationQueue } from './panel_conversation_queue'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

test('serializes work for the same conversation key', async () => {
  const queue = new PanelConversationQueue()
  const firstStarted = deferred()
  const releaseFirst = deferred()
  const order: string[] = []

  const first = queue.run('guild:user', async () => {
    order.push('first:start')
    firstStarted.resolve()
    await releaseFirst.promise
    order.push('first:end')
  })

  await firstStarted.promise
  const second = queue.run('guild:user', async () => {
    order.push('second:start')
    order.push('second:end')
  })

  await Promise.resolve()
  assert.deepEqual(order, ['first:start'])
  releaseFirst.resolve()
  await Promise.all([first, second])
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start', 'second:end'])
  assert.equal(queue.pending_keys(), 0)
})

test('different conversation keys can run concurrently', async () => {
  const queue = new PanelConversationQueue()
  const firstRelease = deferred()
  let secondStarted = false

  const first = queue.run('guild:user-a', async () => {
    await firstRelease.promise
  })
  const second = queue.run('guild:user-b', async () => {
    secondStarted = true
  })

  await second
  assert.equal(secondStarted, true)
  firstRelease.resolve()
  await first
})

test('a failed task does not block the next task for the same key', async () => {
  const queue = new PanelConversationQueue()

  await assert.rejects(
    queue.run('guild:user', async () => {
      throw new Error('boom')
    }),
    /boom/,
  )

  const value = await queue.run('guild:user', async () => 42)
  assert.equal(value, 42)
  assert.equal(queue.pending_keys(), 0)
})
