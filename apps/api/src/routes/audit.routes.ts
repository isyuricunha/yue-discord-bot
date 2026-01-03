import type { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@yuebot/database'

import { can_access_guild } from '../utils/guild_access'
import { is_guild_admin } from '../internal/bot_internal_api'
import { safe_error_details } from '../utils/safe_error'

function clamp_take(input: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(String(input ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function clamp_skip(input: string | undefined) {
  const parsed = Number.parseInt(String(input ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

export async function auditRoutes(fastify: FastifyInstance) {
  fastify.get('/guilds/:guildId/audit', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    const {
      limit = '50',
      offset = '0',
      action,
      actorUserId,
      targetUserId,
      targetChannelId,
      targetMessageId,
    } = request.query as {
      limit?: string
      offset?: string
      action?: string
      actorUserId?: string
      targetUserId?: string
      targetChannelId?: string
      targetMessageId?: string
    }

    const take = clamp_take(limit, 50, 200)
    const skip = clamp_skip(offset)

    const where: Prisma.AuditLogWhereInput = {
      guildId,
    }

    if (action) where.action = action
    if (actorUserId) where.actorUserId = actorUserId
    if (targetUserId) where.targetUserId = targetUserId
    if (targetChannelId) where.targetChannelId = targetChannelId
    if (targetMessageId) where.targetMessageId = targetMessageId

    try {
      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.auditLog.count({ where }),
      ])

      return reply.send({ success: true, logs: rows, total, limit: take, offset: skip })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to list audit logs')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
