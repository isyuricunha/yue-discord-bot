import type { FastifyBaseLogger, FastifyInstance, FastifyPluginAsync } from 'fastify'
import { prisma } from '@yuebot/database'

import { is_guild_admin, sync_automod_native_rules } from '../internal/bot_internal_api'
import { createGuildRouteAuthorization } from './guilds/authorization'
import { PanelConversationQueue, panel_conversation_queue } from '../services/panel_conversation_queue'
import {
  PanelAiApplyProposalStore,
  confirm_panel_ai_apply,
  panel_ai_apply_proposal_store,
  prepare_panel_ai_apply,
  type panel_ai_apply_db,
} from '../services/panel_ai_apply'
import { safe_error_details } from '../utils/safe_error'

type admin_check = (guildId: string, userId: string, log: FastifyBaseLogger) => Promise<{ isAdmin: boolean }>
type guild_exists_check = (guildId: string) => Promise<boolean>
type sync_automod = (guildId: string, log: FastifyBaseLogger) => Promise<unknown>

type panel_ai_apply_route_db = panel_ai_apply_db & {
  guild: Pick<typeof prisma.guild, 'findUnique'>
}

export type panel_ai_apply_route_deps = {
  db: panel_ai_apply_route_db
  store: PanelAiApplyProposalStore
  queue: PanelConversationQueue
  guildExists: guild_exists_check
  isGuildAdmin: admin_check
  syncAutomod: sync_automod
}

function conversation_key(guildId: string, userId: string) {
  return `${guildId}:${userId}`
}

export function createPanelAiApplyRoutes(overrides: Partial<panel_ai_apply_route_deps> = {}): FastifyPluginAsync {
  const db = overrides.db ?? (prisma as panel_ai_apply_route_db)
  const defaultGuildExists: guild_exists_check = async (guildId) => {
    const guild = await db.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    return Boolean(guild)
  }
  const deps: panel_ai_apply_route_deps = {
    db,
    store: overrides.store ?? panel_ai_apply_proposal_store,
    queue: overrides.queue ?? panel_conversation_queue,
    guildExists: overrides.guildExists ?? (overrides.db ? async () => true : defaultGuildExists),
    isGuildAdmin: overrides.isGuildAdmin ?? is_guild_admin,
    syncAutomod: overrides.syncAutomod ?? sync_automod_native_rules,
  }

  const authorization = createGuildRouteAuthorization({
    guildExists: deps.guildExists,
    isGuildAdmin: deps.isGuildAdmin,
  })
  const admin = (fastify: FastifyInstance) => [fastify.authenticate, authorization.requireGuildAdmin]

  return async function panelAiApplyRoutes(fastify: FastifyInstance) {
    fastify.post('/guilds/:guildId/panel-ai/apply-proposals', { preHandler: admin(fastify) }, async (request, reply) => {
      const { guildId } = request.params as { guildId: string }
      const body = request.body as { pageKey?: unknown; changes?: unknown } | null
      const key = conversation_key(guildId, request.user.userId)

      try {
        const result = await deps.queue.run(key, () => prepare_panel_ai_apply({
          db: deps.db,
          store: deps.store,
          guildId,
          userId: request.user.userId,
          pageKey: body?.pageKey,
          changes: body?.changes,
        }))

        if (result.kind === 'invalid') return reply.code(400).send({ error: 'Invalid apply proposal' })
        if (result.kind === 'noop') return reply.send({ success: true, noop: true, proposal: null })
        return reply.send({ success: true, noop: false, proposal: result.proposal })
      } catch (error: unknown) {
        request.log.warn({ err: safe_error_details(error), guildId }, 'Failed to prepare Panel AI apply proposal')
        return reply.code(500).send({ error: 'Could not prepare configuration changes' })
      }
    })

    fastify.post('/guilds/:guildId/panel-ai/apply-proposals/:proposalId/confirm', { preHandler: admin(fastify) }, async (request, reply) => {
      const { guildId, proposalId } = request.params as { guildId: string; proposalId: string }
      const key = conversation_key(guildId, request.user.userId)

      try {
        const result = await deps.queue.run(key, () => confirm_panel_ai_apply({
          db: deps.db,
          store: deps.store,
          guildId,
          userId: request.user.userId,
          proposalId,
        }))

        if (result.kind === 'missing') {
          return reply.code(404).send({ error: 'Apply proposal not found or expired' })
        }
        if (result.kind === 'busy') {
          return reply.code(409).send({ error: 'Apply proposal is already being processed' })
        }
        if (result.kind === 'conflict') {
          return reply.code(409).send({ error: 'Configuration changed; request a new proposal' })
        }

        if (result.result.pageKey === 'automod' && !result.result.replayed) {
          deps.syncAutomod(guildId, request.log).catch((error: unknown) => {
            request.log.error({ err: safe_error_details(error), guildId }, 'Failed to sync AutoMod after Panel AI apply')
          })
        }

        return reply.send({ success: true, result: result.result })
      } catch (error: unknown) {
        request.log.warn({ err: safe_error_details(error), guildId, proposalId }, 'Panel AI configuration apply failed')
        return reply.code(500).send({ error: 'Could not apply configuration changes' })
      }
    })
  }
}

export const panelAiApplyRoutes = createPanelAiApplyRoutes()
