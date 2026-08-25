import test from 'node:test'
import assert from 'node:assert/strict'

import { AfkService, findFirstActiveAfk, type user_afk } from './afk.service'

function makeAfk(userId: string, isAfk = true): user_afk {
  return {
    id: `afk-${userId}`,
    userId,
    guildId: 'guild-1',
    reason: null,
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    isAfk,
  }
}

test('AfkService.getAfks deduplicates users into one database query', async () => {
  const calls: unknown[] = []
  const afks = [makeAfk('user-1'), makeAfk('user-2')]
  const service = new AfkService({
    userAfk: {
      findMany: async (args: unknown) => { calls.push(args); return afks },
    },
  } as any)

  assert.deepEqual(await service.getAfks(['user-1', 'user-2', 'user-1'], 'guild-1'), afks)
  assert.deepEqual(calls, [{ where: { guildId: 'guild-1', userId: { in: ['user-1', 'user-2'] } } }])
})

test('AfkService caches negative author lookups', async () => {
  let reads = 0
  const service = new AfkService({
    userAfk: {
      findUnique: async () => { reads += 1; return null },
    },
  } as any, { cache_ttl_ms: 10_000 })

  assert.equal(await service.getAfk('user-1', 'guild-1'), null)
  assert.equal(await service.getAfk('user-1', 'guild-1'), null)
  assert.equal(reads, 1)
})

test('AfkService only queries batch cache misses', async () => {
  const calls: unknown[] = []
  const service = new AfkService({
    userAfk: {
      findUnique: async () => makeAfk('user-1'),
      findMany: async (args: unknown) => { calls.push(args); return [makeAfk('user-2')] },
    },
  } as any)

  await service.getAfk('user-1', 'guild-1')
  const rows = await service.getAfks(['user-1', 'user-2', 'user-3'], 'guild-1')

  assert.deepEqual(rows.map((row) => row.userId), ['user-1', 'user-2'])
  assert.deepEqual(calls, [{ where: { guildId: 'guild-1', userId: { in: ['user-2', 'user-3'] } } }])
})

test('AfkService set/remove refreshes cache without redundant reads', async () => {
  let findReads = 0
  const row = makeAfk('user-1')
  const service = new AfkService({
    userAfk: {
      upsert: async () => row,
      findUnique: async () => { findReads += 1; return row },
      delete: async () => row,
    },
  } as any)

  await service.setAfk('user-1', 'guild-1', null)
  assert.strictEqual(await service.getAfk('user-1', 'guild-1'), row)
  assert.strictEqual(await service.removeAfk('user-1', 'guild-1'), row)
  assert.equal(await service.getAfk('user-1', 'guild-1'), null)
  assert.equal(findReads, 0)
})

test('AfkService.getAfks skips the database for an empty user list', async () => {
  const service = new AfkService({ userAfk: { findMany: async () => { throw new Error('unexpected') } } } as any)
  assert.deepEqual(await service.getAfks([], 'guild-1'), [])
})

test('findFirstActiveAfk preserves mention order and ignores inactive rows', () => {
  const result = findFirstActiveAfk(
    ['user-1', 'user-2', 'user-3'],
    [makeAfk('user-3'), makeAfk('user-1', false), makeAfk('user-2')]
  )
  assert.equal(result?.userId, 'user-2')
})
