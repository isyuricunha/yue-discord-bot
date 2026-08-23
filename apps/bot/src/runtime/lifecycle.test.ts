import test from 'node:test'
import assert from 'node:assert/strict'

import { RuntimeLifecycle } from './lifecycle'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('runtime lifecycle starts services and stops them in reverse order', async () => {
  const lifecycle = new RuntimeLifecycle()
  const events: string[] = []

  await lifecycle.start_service('first', {
    start: () => { events.push('first:start') },
    stop: () => { events.push('first:stop') },
  })
  await lifecycle.start_service('second', {
    start: () => { events.push('second:start') },
    stop: () => { events.push('second:stop') },
  })

  const errors = await lifecycle.stop_all()

  assert.deepEqual(errors, [])
  assert.deepEqual(events, [
    'first:start',
    'second:start',
    'second:stop',
    'first:stop',
  ])
  assert.equal(lifecycle.count(), 0)
})

test('runtime lifecycle continues shutdown when one service stop fails', async () => {
  const lifecycle = new RuntimeLifecycle()
  const events: string[] = []

  lifecycle.register_started('first', () => {
    events.push('first:stop')
  })
  lifecycle.register_started('broken', () => {
    events.push('broken:stop')
    throw new Error('stop failed')
  })
  lifecycle.register_started('last', () => {
    events.push('last:stop')
  })

  const errors = await lifecycle.stop_all()

  assert.deepEqual(events, ['last:stop', 'broken:stop', 'first:stop'])
  assert.equal(errors.length, 1)
  assert.equal(errors[0]?.name, 'broken')
  assert.match(String(errors[0]?.error), /stop failed/)
})

test('runtime lifecycle shutdown is idempotent', async () => {
  const lifecycle = new RuntimeLifecycle()
  let stops = 0

  lifecycle.register_started('service', () => {
    stops += 1
  })

  await Promise.all([lifecycle.stop_all(), lifecycle.stop_all()])
  await lifecycle.stop_all()

  assert.equal(stops, 1)
})

test('runtime lifecycle cleans a service whose start fails', async () => {
  const lifecycle = new RuntimeLifecycle()
  let stops = 0

  await assert.rejects(
    () => lifecycle.start_service('broken', {
      start: async () => {
        throw new Error('start failed')
      },
      stop: async () => {
        stops += 1
      },
    }),
    /start failed/
  )

  assert.equal(stops, 1)
  assert.equal(lifecycle.count(), 0)
})

test('runtime lifecycle stops a service that finishes starting during shutdown', async () => {
  const lifecycle = new RuntimeLifecycle()
  const start_gate = deferred()
  let stops = 0

  const starting = lifecycle.start_service('slow', {
    start: async () => {
      await start_gate.promise
    },
    stop: async () => {
      stops += 1
    },
  })

  const stopping = lifecycle.stop_all()
  start_gate.resolve()

  await Promise.all([starting, stopping])

  assert.equal(stops, 1)
  assert.equal(lifecycle.count(), 0)
})
