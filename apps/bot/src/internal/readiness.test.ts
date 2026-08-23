import test from 'node:test'
import assert from 'node:assert/strict'

import { get_bot_readiness } from './readiness'

test('bot readiness returns 200 when the Discord client is ready', () => {
  assert.deepEqual(get_bot_readiness({ isReady: () => true }), {
    statusCode: 200,
    body: {
      status: 'ready',
      clientReady: true,
    },
  })
})

test('bot readiness returns 503 when the Discord client is not ready', () => {
  assert.deepEqual(get_bot_readiness({ isReady: () => false }), {
    statusCode: 503,
    body: {
      status: 'not_ready',
      clientReady: false,
    },
  })
})
