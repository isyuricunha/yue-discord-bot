import test from 'node:test'
import assert from 'node:assert/strict'

import { KeyedSerialExecutor } from './keyed-serial'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('KeyedSerialExecutor runs work for the same key sequentially', async () => {
  const executor = new KeyedSerialExecutor()
  const first_started = deferred()
  const release_first = deferred()
  const order: string[] = []

  const first = executor.run('guild:user', async () => {
    order.push('first:start')
    first_started.resolve()
    await release_first.promise
    order.push('first:end')
  })

  await first_started.promise
  const second = executor.run('guild:user', async () => {
    order.push('second:start')
  })

  await Promise.resolve()
  assert.deepEqual(order, ['first:start'])

  release_first.resolve()
  await Promise.all([first, second])
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start'])
})

test('KeyedSerialExecutor allows different keys to run concurrently', async () => {
  const executor = new KeyedSerialExecutor()
  const release = deferred()
  const started: string[] = []

  const first = executor.run('guild:user-a', async () => {
    started.push('a')
    await release.promise
  })
  const second = executor.run('guild:user-b', async () => {
    started.push('b')
    await release.promise
  })

  await Promise.resolve()
  assert.deepEqual(started.sort(), ['a', 'b'])

  release.resolve()
  await Promise.all([first, second])
})

test('KeyedSerialExecutor keeps the queue usable after a failed operation', async () => {
  const executor = new KeyedSerialExecutor()

  await assert.rejects(
    executor.run('guild:user', async () => {
      throw new Error('boom')
    }),
    /boom/,
  )

  const result = await executor.run('guild:user', async () => 'ok')
  assert.equal(result, 'ok')
})
