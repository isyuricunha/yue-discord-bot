import { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import { get_guild_members } from '../internal/bot_internal_api'
import { safe_error_details } from '../utils/safe_error'

export async function membersRoutes(fastify: FastifyInstance) {
  // Get all members for a guild
  fastify.get('/guilds/:guildId/members', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    if (!user.guilds?.includes(guildId)) {
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

    if (!user.guilds?.includes(guildId)) {
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

    if (!user.guilds?.includes(guildId)) {
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
}
