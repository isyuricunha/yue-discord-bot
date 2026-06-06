import test from 'node:test'
import assert from 'node:assert/strict'

import type { Prisma } from '@yuebot/database'

import { build_remove_trigger_where, KeywordTriggerCache } from './keywordTrigger.service'

type keyword_trigger = Prisma.KeywordTriggerGetPayload<Record<string, never>>

function make_trigger(id: string): keyword_trigger {
  return {
    id,
    guildId: 'guild-1',
    keyword: 'hello',
    keywords: ['hello'],
    mediaUrl: null,
    content: 'Hello.',
    channelId: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    replyToUser: true,
  }
}

test('build_remove_trigger_where matches legacy and multi-keyword triggers', () => {
  assert.deepEqual(build_remove_trigger_where('guild-1', '  Hello  '), {
    guildId: 'guild-1',
    OR: [
      { keyword: 'hello' },
      { keywords: { has: 'hello' } },
    ],
  })
})

test('KeywordTriggerCache caches trigger lookups per guild within ttl', async () => {
  const calls: string[] = []
  const triggers = [make_trigger('trigger-1')]
  const cache = new KeywordTriggerCache(async (guild_id) => {
    calls.push(guild_id)
    return triggers
  }, { cache_ttl_ms: 60_000 })

  assert.strictEqual(await cache.get('guild-1'), triggers)
  assert.strictEqual(await cache.get('guild-1'), triggers)
  assert.deepEqual(calls, ['guild-1'])
})

test('KeywordTriggerCache deduplicates concurrent lookups for one guild', async () => {
  const triggers = [make_trigger('trigger-1')]
  let resolve_load: ((value: keyword_trigger[]) => void) | undefined
  let calls = 0
  const cache = new KeywordTriggerCache(() => {
    calls += 1
    return new Promise<keyword_trigger[]>((resolve) => {
      resolve_load = resolve
    })
  }, { cache_ttl_ms: 60_000 })

  const first = cache.get('guild-1')
  const second = cache.get('guild-1')

  assert.equal(calls, 1)
  resolve_load?.(triggers)
  assert.deepEqual(await Promise.all([first, second]), [triggers, triggers])
})

test('KeywordTriggerCache prevents an invalidated load from replacing fresh data', async () => {
  const stale_triggers = [make_trigger('stale')]
  const fresh_triggers = [make_trigger('fresh')]
  let resolve_stale_load: ((value: keyword_trigger[]) => void) | undefined
  let calls = 0
  const cache = new KeywordTriggerCache(() => {
    calls += 1
    if (calls === 1) {
      return new Promise<keyword_trigger[]>((resolve) => {
        resolve_stale_load = resolve
      })
    }
    return Promise.resolve(fresh_triggers)
  }, { cache_ttl_ms: 60_000 })

  const stale_load = cache.get('guild-1')
  cache.invalidate('guild-1')
  assert.strictEqual(await cache.get('guild-1'), fresh_triggers)

  resolve_stale_load?.(stale_triggers)
  assert.strictEqual(await stale_load, stale_triggers)
  assert.strictEqual(await cache.get('guild-1'), fresh_triggers)
  assert.equal(calls, 2)
})

test('KeywordTriggerCache retries after a failed load', async () => {
  const triggers = [make_trigger('trigger-1')]
  let calls = 0
  const cache = new KeywordTriggerCache(async () => {
    calls += 1
    if (calls === 1) throw new Error('temporary database failure')
    return triggers
  }, { cache_ttl_ms: 60_000 })

  await assert.rejects(cache.get('guild-1'), /temporary database failure/)
  assert.strictEqual(await cache.get('guild-1'), triggers)
  assert.equal(calls, 2)
})
