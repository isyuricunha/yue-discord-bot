import test from 'node:test'
import assert from 'node:assert/strict'

import { map_with_concurrency } from './concurrency'

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

test('map_with_concurrency limits active operations and preserves result order', async () => {
  let active = 0
  let max_active = 0

  const result = await map_with_concurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1
    max_active = Math.max(max_active, active)
    await delay(value % 2 === 0 ? 2 : 5)
    active -= 1
    return value * 10
  })

  assert.deepEqual(result, [10, 20, 30, 40, 50])
  assert.equal(max_active, 2)
})

test('map_with_concurrency treats non-positive limits as one worker', async () => {
  let active = 0
  let max_active = 0

  await map_with_concurrency([1, 2, 3], 0, async () => {
    active += 1
    max_active = Math.max(max_active, active)
    await delay(1)
    active -= 1
  })

  assert.equal(max_active, 1)
})

test('map_with_concurrency stops scheduling new work after a failure', async () => {
  const started: number[] = []

  await assert.rejects(
    map_with_concurrency([1, 2, 3, 4, 5], 1, async (value) => {
      started.push(value)
      if (value === 2) throw new Error('sync failure')
      return value
    }),
    /sync failure/,
  )

  assert.deepEqual(started, [1, 2])
})
