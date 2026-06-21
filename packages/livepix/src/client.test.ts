import assert from 'node:assert/strict'
import test from 'node:test'

import {
  build_livepix_authorization_url,
  LivePixApiError,
  LivePixClient,
  LivePixClientCredentialsTokenCache,
} from './client'

test('LivePix authorization URL uses required OAuth fields and deduplicated scopes', () => {
  const url = new URL(
    build_livepix_authorization_url({
      clientId: 'client-id',
      redirectUri: 'https://api.example.com/api/livepix/oauth/callback',
      state: 'state-value',
      scopes: ['account:read', 'payments:read', 'payments:read'],
      authorizationUrl: 'https://oauth.example.test/oauth2/auth',
    })
  )

  assert.equal(url.origin, 'https://oauth.example.test')
  assert.equal(url.searchParams.get('client_id'), 'client-id')
  assert.equal(url.searchParams.get('redirect_uri'), 'https://api.example.com/api/livepix/oauth/callback')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('scope'), 'account:read payments:read')
  assert.equal(url.searchParams.get('state'), 'state-value')
})

test('LivePix payment creation sends only provider-supported server fields', async () => {
  const requests: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init: init ?? {} })
    return new Response(
      JSON.stringify({
        data: {
          reference: 'provider-reference',
          redirectUrl: 'https://checkout.livepix.gg/pay/provider-reference',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }
  const client = new LivePixClient({ apiBaseUrl: 'https://api.example.test', fetchImpl })

  const checkout = await client.createPayment('access-token', {
    amount: 2500,
    currency: 'BRL',
    redirectUrl: 'https://api.example.com/api/livepix/return',
  })

  assert.equal(checkout.reference, 'provider-reference')
  assert.equal(checkout.redirectUrl, 'https://checkout.livepix.gg/pay/provider-reference')
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.url, 'https://api.example.test/v2/payments')
  assert.deepEqual(JSON.parse(String(requests[0]?.init.body)), {
    amount: 2500,
    currency: 'BRL',
    redirectUrl: 'https://api.example.com/api/livepix/return',
  })
  assert.equal((requests[0]?.init.headers as Record<string, string>).authorization, 'Bearer access-token')
})

test('LivePix payment creation rejects invalid local amounts before provider calls', async () => {
  const client = new LivePixClient({
    fetchImpl: async () => {
      throw new Error('fetch should not be called')
    },
  })

  await assert.rejects(
    () =>
      client.createPayment('access-token', {
        amount: 0,
        currency: 'BRL',
        redirectUrl: 'https://api.example.com/api/livepix/return',
      }),
    /positive integer/
  )
})

test('LivePix client reports retryable rate limit errors with headers', async () => {
  const client = new LivePixClient({
    apiBaseUrl: 'https://api.example.test',
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '123',
        },
      }),
  })

  await assert.rejects(
    () => client.getAccount('access-token'),
    (error) => {
      assert.ok(error instanceof LivePixApiError)
      assert.equal(error.code, 'rate_limited')
      assert.equal(error.retryable, true)
      assert.deepEqual(error.rateLimit, { limit: 60, remaining: 0, reset: 123 })
      return true
    }
  )
})

test('LivePix client credentials cache deduplicates concurrent token requests', async () => {
  let tokenRequests = 0
  const client = new LivePixClient({
    oauthBaseUrl: 'https://oauth.example.test',
    fetchImpl: async () => {
      tokenRequests += 1
      return new Response(
        JSON.stringify({
          access_token: 'cached-token',
          expires_in: 3600,
          scope: 'account:read payments:read',
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })
  const cache = new LivePixClientCredentialsTokenCache(client, {
    clientId: 'client-id',
    clientSecret: 'client-secret',
  })

  const [first, second, third] = await Promise.all([
    cache.getAccessToken(),
    cache.getAccessToken(),
    cache.getAccessToken(),
  ])

  assert.equal(first, 'cached-token')
  assert.equal(second, 'cached-token')
  assert.equal(third, 'cached-token')
  assert.equal(tokenRequests, 1)
})
