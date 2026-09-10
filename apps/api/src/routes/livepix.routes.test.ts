import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

import type { prisma } from '@yuebot/database'

import { createLivePixRoutes } from './livepix.routes'

type livepix_db = {
  livePixWebhookEvent: {
    create: (args: any) => Promise<any>
    update: (args: any) => Promise<any>
  }
  supportPayment: {
    findUnique: (args: any) => Promise<any>
  }
}

function make_db(overrides: { payment?: unknown } = {}) {
  const calls = { create: 0, update: 0, fulfill: 0 }

  const db: livepix_db = {
    livePixWebhookEvent: {
      create: async () => {
        calls.create += 1
        return { id: 'event-1' }
      },
      update: async () => {
        calls.update += 1
        return {}
      },
    },
    supportPayment: {
      findUnique: async () => overrides.payment ?? null,
    },
  }

  return { db, calls }
}

async function inject_webhook(db: livepix_db, reference: string | null, resourceType = 'payment') {
  const app = Fastify()
  app.register(
    createLivePixRoutes({
      config: {
        livePix: {
          enabled: true,
          clientId: 'expected-client',
          clientSecret: 'secret',
          oauthRedirectUri: 'https://example.test/oauth/callback',
          webhookUrl: 'https://example.test/api/livepix/webhook',
          tokenEncryptionKey: 'a'.repeat(32),
          ownerGuildIds: [],
        },
        web: { url: 'https://example.test' },
      },
      handleLivePixOAuthCallback: async () => {
        throw new Error('unused')
      },
      db: db as unknown as Pick<typeof prisma, 'livePixWebhookEvent' | 'supportPayment'>,
      verifyAndFulfillSupportPayment: async () => {
        calls_fulfillment += 1
        return { success: true, status: 'fulfilled', message: 'ok' }
      },
    }),
    { prefix: '/api' }
  )

  const resource: Record<string, unknown> = { type: resourceType, id: 'attacker-payment' }
  if (reference !== null) resource.reference = reference

  const response = await app.inject({
    method: 'POST',
    url: '/api/livepix/webhook',
    payload: { event: 'new', resource },
  })

  await app.close()
  return response
}

let calls_fulfillment = 0

test('forged webhook with an unknown reference is ignored without persisting anything (audit finding API-001)', async () => {
  calls_fulfillment = 0
  const { db, calls } = make_db({ payment: null })

  const response = await inject_webhook(db, 'forged-reference')

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().ignored, true)
  assert.equal(calls.create, 0, 'forged events must not be persisted')
  assert.equal(calls.fulfill, 0)
})

test('non-payment resources are ignored without persisting anything (audit finding API-001)', async () => {
  calls_fulfillment = 0
  const { db, calls } = make_db({ payment: null })

  const response = await inject_webhook(db, null, 'subscription')

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().ignored, true)
  assert.equal(calls.create, 0)
  assert.equal(calls.fulfill, 0)
})

test('webhooks tied to a real payment reference are persisted once and fulfilled', async () => {
  calls_fulfillment = 0
  const { db, calls } = make_db({
    payment: { id: 'payment-1', guildId: 'guild-1' },
  })

  const response = await inject_webhook(db, 'known-reference')

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().status, 'fulfilled')
  assert.equal(calls.create, 1)
  assert.equal(calls_fulfillment, 1)
})
