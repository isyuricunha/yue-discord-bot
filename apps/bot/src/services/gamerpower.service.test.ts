import test from 'node:test'
import assert from 'node:assert/strict'

import { GamerPowerService } from './gamerpower.service'

type http_get = <T>(
  url: string,
  options: { timeout: number; headers: { Accept: string } }
) => Promise<{ data: T }>

test('GamerPowerService.getAllGiveaways: does not send multiple types (avoids type=game,loot,...)', async () => {
  const calls: string[] = []

  const http_get: http_get = async <T>(url: string, _options) => {
    calls.push(url)
    return { data: [] as unknown as T }
  }

  const service = new GamerPowerService({ http_get })

  await service.getAllGiveaways({
    types: ['game', 'loot', 'beta'],
    sortBy: 'date',
  })

  assert.equal(calls.length, 1)
  const called = calls[0] ?? ''
  assert.ok(called.includes('/giveaways?'))
  assert.ok(called.includes('sort-by=date'))
  assert.ok(!called.includes('type='))
})

test('GamerPowerService.getAllGiveaways: includes single type when provided', async () => {
  const calls: string[] = []

  const http_get: http_get = async <T>(url: string, _options) => {
    calls.push(url)
    return { data: [] as unknown as T }
  }

  const service = new GamerPowerService({ http_get })

  await service.getAllGiveaways({
    types: ['game'],
    sortBy: 'date',
  })

  assert.equal(calls.length, 1)
  const called = calls[0] ?? ''
  assert.ok(called.includes('type=game'))
})

test('GamerPowerService.getAllGiveaways: falls back on 404 by retrying without type', async () => {
  const calls: string[] = []

  const http_get: http_get = async <T>(url: string, _options) => {
    calls.push(url)

    if (calls.length === 1) {
      const err: any = new Error('not found')
      err.isAxiosError = true
      err.response = { status: 404 }
      throw err
    }

    return { data: [{ id: 1 } as any] as unknown as T }
  }

  const service = new GamerPowerService({ http_get })

  const result = await service.getAllGiveaways({
    platforms: ['steam'],
    types: ['game'],
    sortBy: 'date',
  })

  assert.equal(result.length, 1)
  assert.ok(calls.length >= 2)

  const first = calls[0] ?? ''
  const second = calls[1] ?? ''
  assert.ok(first.includes('platform=steam'))
  assert.ok(first.includes('type=game'))
  assert.ok(second.includes('platform=steam'))
  assert.ok(!second.includes('type='))
})

test('GamerPowerService.getAllGiveaways: uses cached response after transient network failure', async () => {
  const calls: string[] = []
  const cached = [{ id: 123, title: 'Cached Giveaway' } as any]

  const http_get: http_get = async <T>(url: string, _options) => {
    calls.push(url)

    if (calls.length === 1) {
      return { data: cached as unknown as T }
    }

    const err: any = new Error('socket reset')
    err.code = 'ECONNRESET'
    throw err
  }

  const service = new GamerPowerService({
    http_get,
    cache_ttl_ms: 60_000,
    max_attempts: 1,
  })

  const first = await service.getAllGiveaways({ sortBy: 'date' })
  const second = await service.getAllGiveaways({ sortBy: 'date' })

  assert.deepEqual(first, cached)
  assert.deepEqual(second, cached)
  assert.equal(calls.length, 2)
})
