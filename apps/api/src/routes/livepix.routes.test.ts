import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

import { createLivePixRoutes } from './livepix.routes'

function make_config() {
  return {
    livePix: {
      enabled: true,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      oauthRedirectUri: 'https://yuebot.yuricunha.com/api/livepix/oauth/callback',
      webhookUrl: 'https://yuebot.yuricunha.com/api/livepix/webhook',
      tokenEncryptionKey: 'a'.repeat(32),
      ownerGuildIds: [],
    },
    web: {
      url: 'https://yuebot.yuricunha.com',
    },
  }
}

function fail_if_called(name: string) {
  return async () => {
    assert.fail(`${name} should not be called`)
  }
}

test('LivePix application notification URL webhook fulfills support payment by reference', async (t) => {
  const calls = {
    webhookCreates: [] as any[],
    webhookUpdates: [] as any[],
    paymentLookups: [] as any[],
    fulfillments: [] as any[],
  }

  const app = Fastify()
  app.register(
    createLivePixRoutes({
      config: make_config() as any,
      handleLivePixOAuthCallback: fail_if_called('handleLivePixOAuthCallback') as any,
      db: {
        livePixWebhookEvent: {
          create: async (args: any) => {
            calls.webhookCreates.push(args)
            return { id: 'webhook-event-1' }
          },
          update: async (args: any) => {
            calls.webhookUpdates.push(args)
            return { id: args.where.id, ...args.data }
          },
        },
        supportPayment: {
          findUnique: async (args: any) => {
            calls.paymentLookups.push(args)
            return { id: 'payment-1', guildId: 'guild-1' }
          },
        },
      } as any,
      verifyAndFulfillSupportPayment: (async (input: any) => {
        calls.fulfillments.push(input)
        return {
          success: true,
          status: 'fulfilled',
          message: 'Pagamento confirmado.',
        }
      }) as any,
    }),
    { prefix: '/api' }
  )

  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/livepix/webhook',
    payload: {
      userId: 'provider-account-1',
      clientId: 'client-id',
      event: 'new',
      resource: {
        id: 'provider-payment-1',
        reference: 'support-payment-reference',
        type: 'payment',
      },
    },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { success: true, status: 'fulfilled' })
  assert.equal(calls.webhookCreates.length, 1)
  assert.deepEqual(calls.webhookCreates[0]?.data, {
    dedupeKey: 'client-id:new:payment:provider-payment-1',
    clientId: 'client-id',
    event: 'new',
    resourceType: 'payment',
    resourceId: 'provider-payment-1',
    reference: 'support-payment-reference',
  })
  assert.deepEqual(calls.paymentLookups[0], {
    where: { livePixReference: 'support-payment-reference' },
    select: { id: true, guildId: true },
  })
  assert.deepEqual(calls.fulfillments, [{ guildId: 'guild-1', paymentId: 'payment-1' }])
  assert.deepEqual(calls.webhookUpdates[0], {
    where: { id: 'webhook-event-1' },
    data: {
      guildId: 'guild-1',
      supportPaymentId: 'payment-1',
    },
  })
  assert.equal(calls.webhookUpdates[1]?.data.status, 'PROCESSED')
  assert.equal(calls.webhookUpdates[1]?.data.failureCode, null)
})
