import test from 'node:test'
import assert from 'node:assert/strict'

import { ConversationQueue } from './conversation_queue'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('serializes tasks for the same conversation key', async () => {
  const queue = new ConversationQueue()
  const first_gate = deferred<void>()
  const events: string[] = []

  const first = queue.run('guild:channel:user', async () => {
    events.push('first:start')
    await first_gate.promise
    events.push('first:end')
  })

  const second = queue.run('guild:channel:user', async () => {
    events.push('second:start')
    events.push('second:end')
  })

  await Promise.resolve()
  assert.deepEqual(events, ['first:start'])

  first_gate.resolve()
  await Promise.all([first, second])

  assert.deepEqual(events, [
    'first:start',
    'first:end',
    'second:start',
    'second:end',
  ])
  assert.equal(queue.pending_keys(), 0)
})

test('allows different conversation keys to run concurrently', async () => {
  const queue = new ConversationQueue()
  const gate = deferred<void>()
  const events: string[] = []

  const first = queue.run('conversation-a', async () => {
    events.push('a:start')
    await gate.promise
    events.push('a:end')
  })

  const second = queue.run('conversation-b', async () => {
    events.push('b:start')
    events.push('b:end')
  })

  await second
  assert.deepEqual(events, ['a:start', 'b:start', 'b:end'])

  gate.resolve()
  await first
  assert.deepEqual(events, ['a:start', 'b:start', 'b:end', 'a:end'])
})

test('releases the key when a task fails', async () => {
  const queue = new ConversationQueue()

  await assert.rejects(
    () => queue.run('conversation', async () => {
      throw new Error('boom')
    }),
    /boom/
  )

  const result = await queue.run('conversation', async () => 'recovered')
  assert.equal(result, 'recovered')
  assert.equal(queue.pending_keys(), 0)
})
