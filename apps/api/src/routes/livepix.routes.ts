import type { FastifyInstance } from 'fastify'
import { Prisma, prisma } from '@yuebot/database'
import { z } from 'zod'
import { verify_and_fulfill_support_payment } from '../internal/bot_internal_api'
import { CONFIG } from '../config'
import { safe_error_details } from '../utils/safe_error'
import { handle_livepix_oauth_callback, SupportApiError } from '../services/support/livepix_connections'

type livepix_routes_dependencies = {
  db: Pick<typeof prisma, 'livePixWebhookEvent' | 'supportPayment'>
  config: Pick<typeof CONFIG, 'livePix' | 'web'>
  handleLivePixOAuthCallback: typeof handle_livepix_oauth_callback
  verifyAndFulfillSupportPayment: typeof verify_and_fulfill_support_payment
}

const livepixWebhookSchema = z.object({
  userId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  event: z.string().min(1),
  resource: z.object({
    id: z.string().min(1).optional(),
    reference: z.string().min(1).optional(),
    type: z.string().min(1),
  }),
})

function is_unique_constraint_error(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function build_webhook_dedupe_key(input: {
  clientId: string | null
  event: string
  resourceType: string
  resourceId: string | null
  reference: string | null
}) {
  return [
    input.clientId ?? 'unknown-client',
    input.event,
    input.resourceType,
    input.resourceId ?? input.reference ?? 'unknown-resource',
  ].join(':')
}

function html(body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LivePix</title>
  </head>
  <body>
    <main style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem;">
      ${body}
    </main>
  </body>
</html>`
}

function default_livepix_routes_dependencies(): livepix_routes_dependencies {
  return {
    db: prisma,
    config: CONFIG,
    handleLivePixOAuthCallback: handle_livepix_oauth_callback,
    verifyAndFulfillSupportPayment: verify_and_fulfill_support_payment,
  }
}

export function createLivePixRoutes(
  dependencies: livepix_routes_dependencies = default_livepix_routes_dependencies()
) {
  return async function livePixRoutesWithDependencies(fastify: FastifyInstance) {
    fastify.get('/livepix/oauth/callback', async (request, reply) => {
      const query = request.query as { code?: string; state?: string; error?: string }

      if (query.error) {
        return reply
          .type('text/html; charset=utf-8')
          .code(400)
          .send(html('<h1>LivePix connection was not completed.</h1><p>Return to the dashboard and try connecting again.</p>'))
      }

      if (!query.code || !query.state) {
        return reply
          .type('text/html; charset=utf-8')
          .code(400)
          .send(html('<h1>Invalid LivePix callback.</h1><p>Return to the dashboard and start the connection again.</p>'))
      }

      try {
        const result = await dependencies.handleLivePixOAuthCallback({
          code: query.code,
          state: query.state,
          log: request.log,
        })

        const redirect = new URL(`/guild/${result.guildId}/support`, dependencies.config.web.url)
        redirect.searchParams.set('livepix', 'connected')
        return reply.redirect(redirect.toString())
      } catch (error) {
        const status = error instanceof SupportApiError ? error.statusCode : 500
        request.log.warn({ err: safe_error_details(error) }, 'LivePix OAuth callback failed')
        return reply
          .type('text/html; charset=utf-8')
          .code(status)
          .send(html('<h1>LivePix connection failed.</h1><p>Return to the dashboard and try connecting again.</p>'))
      }
    })

    fastify.get('/livepix/return', async (_request, reply) => {
      return reply
        .type('text/html; charset=utf-8')
        .send(
          html(
            '<h1>Payment submitted.</h1><p>Return to Discord and use "Verificar pagamento" while confirmation is processed.</p>'
          )
        )
    })

    fastify.post('/livepix/webhook', async (request, reply) => {
      if (!dependencies.config.livePix.enabled) {
        return reply.code(503).send({ error: 'LivePix is not configured' })
      }

      const parsed = livepixWebhookSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid webhook payload' })
      }

      const payload = parsed.data
      const clientId = payload.clientId ?? null
      const resourceId = payload.resource.id ?? null
      const reference = payload.resource.reference ?? null
      const resourceType = payload.resource.type

      if (clientId && dependencies.config.livePix.clientId && clientId !== dependencies.config.livePix.clientId) {
        request.log.warn({ clientId, event: payload.event, resourceType }, 'Rejected LivePix webhook for unexpected client')
        return reply.code(400).send({ error: 'Invalid webhook payload' })
      }

      const dedupeKey = build_webhook_dedupe_key({
        clientId,
        event: payload.event,
        resourceType,
        resourceId,
        reference,
      })

      let event_id: string
      try {
        const created = await dependencies.db.livePixWebhookEvent.create({
          data: {
            dedupeKey,
            clientId,
            event: payload.event,
            resourceType,
            resourceId,
            reference,
          },
          select: { id: true },
        })
        event_id = created.id
      } catch (error) {
        if (is_unique_constraint_error(error)) {
          return reply.send({ success: true, duplicate: true })
        }

        request.log.error({ err: safe_error_details(error) }, 'Failed to persist LivePix webhook event')
        return reply.code(503).send({ error: 'Temporary failure' })
      }

      if (resourceType !== 'payment' || !reference) {
        await dependencies.db.livePixWebhookEvent.update({
          where: { id: event_id },
          data: {
            status: 'IGNORED',
            processedAt: new Date(),
            failureCode: resourceType !== 'payment' ? 'unsupported_resource_type' : 'missing_reference',
          },
        })
        return reply.send({ success: true, ignored: true })
      }

      const payment = await dependencies.db.supportPayment.findUnique({
        where: { livePixReference: reference },
        select: { id: true, guildId: true },
      })

      if (!payment) {
        await dependencies.db.livePixWebhookEvent.update({
          where: { id: event_id },
          data: {
            status: 'IGNORED',
            processedAt: new Date(),
            failureCode: 'unknown_reference',
          },
        })
        return reply.send({ success: true, ignored: true })
      }

      await dependencies.db.livePixWebhookEvent.update({
        where: { id: event_id },
        data: {
          guildId: payment.guildId,
          supportPaymentId: payment.id,
        },
      })

      try {
        const fulfillment = await dependencies.verifyAndFulfillSupportPayment(
          { guildId: payment.guildId, paymentId: payment.id },
          request.log
        )

        await dependencies.db.livePixWebhookEvent.update({
          where: { id: event_id },
          data: {
            status: fulfillment.status === 'mismatch' ? 'PERMANENT_FAILURE' : 'PROCESSED',
            processedAt: new Date(),
            failureCode: fulfillment.status === 'mismatch' ? 'payment_mismatch' : null,
          },
        })

        return reply.send({ success: true, status: fulfillment.status })
      } catch (error) {
        request.log.warn({ err: safe_error_details(error), eventId: event_id }, 'LivePix webhook fulfillment failed')
        await dependencies.db.livePixWebhookEvent.update({
          where: { id: event_id },
          data: {
            status: 'RETRYABLE_FAILURE',
            failureCode: 'fulfillment_failed',
          },
        }).catch(() => null)

        return reply.code(503).send({ error: 'Temporary failure' })
      }
    })
  }
}

export async function livePixRoutes(fastify: FastifyInstance) {
  return createLivePixRoutes()(fastify)
}
