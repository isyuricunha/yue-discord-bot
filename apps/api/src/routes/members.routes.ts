import { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import { memberModerationActionSchema } from '@yuebot/shared'

import { InternalBotApiError, get_guild_members, moderate_guild_member } from '../internal/bot_internal_api'
import { safe_error_details } from '../utils/safe_error'
import { can_access_guild } from '../utils/guild_access'
import { public_error_message } from '../utils/public_error'
import { validation_error_details } from '../utils/validation_error'

export async function membersRoutes(fastify: FastifyInstance) {
  // Get all members for a guild
  fastify.get('/guilds/:guildId/members', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    try {
      const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
      if (!guild) {
        return reply.code(404).send({ error: 'Guild not found' })
      }

      const existing_count = await prisma.guildMember.count({ where: { guildId } })

      if (existing_count === 0) {
        const data = await get_guild_members(guildId, request.log)

        if (data.members.length > 0) {
          await prisma.guildMember.createMany({
            data: data.members
              .filter((m) => Boolean(m.joinedAt))
              .map((m) => ({
                guildId,
                userId: m.userId,
                username: m.username,
                avatar: m.avatar,
                joinedAt: new Date(m.joinedAt as string),
              })),
            skipDuplicates: true,
          })
        }
      }

      const members = await prisma.guildMember.findMany({
        where: { guildId },
        orderBy: { joinedAt: 'desc' },
      })

      return reply.send(members)
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to list guild members')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Get member details with history
  fastify.get('/guilds/:guildId/members/:userId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    try {
      const member = await prisma.guildMember.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        include: {
          modLogs: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })

      if (!member) {
        return reply.code(404).send({ error: 'Member not found' })
      }

      return reply.send(member)
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to get member details')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Update member notes
  fastify.patch('/guilds/:guildId/members/:userId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }
    const { notes } = request.body as { notes: string }
    const user = request.user

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    try {
      const member = await prisma.guildMember.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: { notes },
      })

      return reply.send(member)
    } catch (error: unknown) {
      const prismaError = error as { code?: unknown }
      if (prismaError.code === 'P2025') {
        return reply.code(404).send({ error: 'Member not found' })
      }

      fastify.log.error({ err: safe_error_details(error) }, 'Failed to update member notes')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Moderate member (ban/kick/timeout/etc)
  fastify.post('/guilds/:guildId/members/:userId/moderate', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }
    const user = request.user as { userId?: string } & Parameters<typeof can_access_guild>[0]
    const parsed = memberModerationActionSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    if (!guild) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    const moderator_id = user.userId
    if (typeof moderator_id !== 'string' || moderator_id.length === 0) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const action = parsed.data.action

      const base = {
        guildId,
        action,
        moderatorId: moderator_id,
        userId,
      } as const

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

        // If it's a user/action error (4xx), return it as-is so the UI can show the real reason.
        if (upstream_status >= 400 && upstream_status < 500) {
          return reply.code(upstream_status).send({ error: upstream_error ?? 'Request rejected by bot' })
        }

        request.log.error(
          { err: safe_error_details(error), upstreamStatus: upstream_status, upstreamError: upstream_error },
          'Bot internal API returned server error'
        )

        return reply
          .code(502)
          .send({ error: public_error_message(fastify, 'Failed to moderate member', 'Bad gateway') })
      }

      request.log.error({ err: safe_error_details(error) }, 'Failed to moderate member via bot internal API')
      return reply.code(502).send({ error: public_error_message(fastify, 'Failed to moderate member', 'Bad gateway') })
    }
  })
}
