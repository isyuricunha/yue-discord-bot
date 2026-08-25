import type { FastifyInstance } from 'fastify'
import { Prisma, prisma } from '@yuebot/database'
import { memberModerationActionSchema, memberNotesUpdateSchema } from '@yuebot/shared'

import { InternalBotApiError, moderate_guild_member } from '../internal/bot_internal_api'
import { public_error_message } from '../utils/public_error'
import { safe_error_details } from '../utils/safe_error'
import { parse_query_integer } from '../utils/pagination'
import { validation_error_details } from '../utils/validation_error'
import { requireGuildAdmin } from './guilds/authorization'

function member_warning_filter(value: unknown): Prisma.IntFilter | number | undefined {
  if (value === 'clean') return 0
  if (value === 'low') return { gte: 1, lte: 3 }
  if (value === 'high') return { gte: 4 }
  return undefined
}

export async function membersRoutes(fastify: FastifyInstance) {
  const admin = [fastify.authenticate, requireGuildAdmin]

  fastify.get('/guilds/:guildId/members', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const query = request.query && typeof request.query === 'object'
      ? request.query as Record<string, unknown>
      : {}
    const page = parse_query_integer(query.page, { fallback: 1, min: 1 })
    const limit = parse_query_integer(query.limit, { fallback: 12, min: 1, max: 100 })
    const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : ''
    const warnings = member_warning_filter(query.warnings)

    const where: Prisma.GuildMemberWhereInput = {
      guildId,
      ...(warnings !== undefined ? { warnings } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { userId: { contains: search } },
            ],
          }
        : {}),
    }

    try {
      const [total, members] = await Promise.all([
        prisma.guildMember.count({ where }),
        prisma.guildMember.findMany({
          where,
          orderBy: [{ username: 'asc' }, { userId: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            userId: true,
            username: true,
            avatar: true,
            joinedAt: true,
            warnings: true,
            notes: true,
          },
        }),
      ])

      return reply.send({
        success: true,
        members,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to list guild members')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.get('/guilds/:guildId/members/:userId', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }

    try {
      const member = await prisma.guildMember.findUnique({
        where: { userId_guildId: { userId, guildId } },
        include: {
          modLogs: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })

      if (!member) return reply.code(404).send({ error: 'Member not found' })
      return reply.send({ success: true, member })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to get member details')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.patch('/guilds/:guildId/members/:userId', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }
    const parsed = memberNotesUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    try {
      const member = await prisma.guildMember.update({
        where: { userId_guildId: { userId, guildId } },
        data: { notes: parsed.data.notes },
      })
      return reply.send({ success: true, member })
    } catch (error: unknown) {
      const prismaError = error as { code?: unknown }
      if (prismaError.code === 'P2025') return reply.code(404).send({ error: 'Member not found' })
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to update member notes')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.post('/guilds/:guildId/members/:userId/moderate', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }
    const moderator_id = request.user.userId
    const parsed = memberModerationActionSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    try {
      const action = parsed.data.action
      const base = { guildId, action, moderatorId: moderator_id, userId } as const

      if (action === 'ban') {
        await moderate_guild_member({
          ...base,
          reason: parsed.data.reason,
          deleteMessageDays: parsed.data.deleteMessageDays,
        }, request.log)
      } else if (action === 'timeout') {
        await moderate_guild_member({
          ...base,
          duration: parsed.data.duration,
          reason: parsed.data.reason,
        }, request.log)
      } else {
        await moderate_guild_member({
          ...base,
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        }, request.log)
      }

      return reply.send({ success: true })
    } catch (error: unknown) {
      if (error instanceof InternalBotApiError) {
        const upstream_status = error.status
        const body = error.body
        const upstream_error =
          body && typeof body === 'object' && 'error' in body && typeof (body as Record<string, unknown>).error === 'string'
            ? String((body as Record<string, unknown>).error)
            : null

        if (upstream_status >= 400 && upstream_status < 500) {
          return reply.code(upstream_status).send({
            error: upstream_error?.trim() || `Request rejected by bot (status ${upstream_status})`,
          })
        }

        request.log.error(
          { err: safe_error_details(error), upstreamStatus: upstream_status, upstreamError: upstream_error },
          'Bot internal API returned server error'
        )
        return reply.code(502).send({ error: public_error_message(fastify, 'Failed to moderate member', 'Bad gateway') })
      }

      request.log.error({ err: safe_error_details(error) }, 'Failed to moderate member via bot internal API')
      return reply.code(502).send({ error: public_error_message(fastify, 'Failed to moderate member', 'Bad gateway') })
    }
  })
}
