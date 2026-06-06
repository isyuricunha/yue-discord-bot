import test from 'node:test'
import assert from 'node:assert/strict'

import { SuggestionConfigCache, SuggestionService } from './suggestion.service'

test('SuggestionService caches disabled configs and supports guild invalidation', async () => {
  const calls: string[] = []
  let enabled = false
  const cache = new SuggestionConfigCache(async (guild_id) => {
    calls.push(guild_id)
    return {
      enabled,
      channelId: enabled ? 'channel-1' : null,
      logChannelId: null,
    }
  }, { cache_ttl_ms: 60_000 })
  const service = new SuggestionService(cache)

  assert.deepEqual(await service.get_config('guild-1'), {
    enabled: false,
    channelId: null,
    logChannelId: null,
  })

  enabled = true
  assert.equal((await service.get_config('guild-1')).enabled, false)

  service.invalidate_config('guild-1')
  assert.deepEqual(await service.get_config('guild-1'), {
    enabled: true,
    channelId: 'channel-1',
    logChannelId: null,
  })
  assert.deepEqual(calls, ['guild-1', 'guild-1'])
})
