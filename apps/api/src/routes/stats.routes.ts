import { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import axios from 'axios'
import { can_access_guild } from '../utils/guild_access'
import { safe_error_details } from '../utils/safe_error'

export async function statsRoutes(fastify: FastifyInstance) {
  // Get guild statistics
  fastify.get('/guilds/:guildId/stats', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user

    // Verificar permissão
    if (!can_access_guild(user, guildId)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    try {
      // Get total members (from Discord API or cache)
      const guild = await prisma.guild.findUnique({
        where: { id: guildId },
      })

      if (!guild) {
        return reply.code(404).send({ error: 'Guild not found' })
      }

      // Count moderation actions (7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const moderationActions7d = await prisma.modLog.count({
        where: {
          guildId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      })

      // Count moderation actions (30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const moderationActions30d = await prisma.modLog.count({
        where: {
          guildId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      })

      // Count active giveaways
      const activeGiveaways = await prisma.giveaway.count({
        where: {
          guildId,
          ended: false,
          cancelled: false,
        },
      })

      // Count total giveaways
      const totalGiveaways = await prisma.giveaway.count({
        where: {
          guildId,
        },
      })

      // Get guild config for banned words count
      const config = await prisma.guildConfig.findUnique({
        where: { guildId },
      })

      const bannedWords = config?.bannedWords 
        ? (Array.isArray(config.bannedWords) ? config.bannedWords.length : 0)
        : 0

      // Get recent actions (last 10)
      const recentActions = await prisma.modLog.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          userId: true,
          moderatorId: true,
          reason: true,
          createdAt: true,
        },
      })

      // Get actions by type (last 7 days)
      const actionsByTypeData = await prisma.modLog.groupBy({
        by: ['action'],
        where: {
          guildId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        _count: {
          action: true,
        },
      })

      const actionsByType: Record<string, number> = {}
      actionsByTypeData.forEach(item => {
        actionsByType[item.action] = item._count.action
      })

      // Fetch total members from Discord API
      let totalMembers = 0
      try {
        const bot_token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN
        if (!bot_token) {
          throw new Error('Missing Discord bot token')
        }

        const discordResponse = await axios.get(
          `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`,
          {
            headers: {
              Authorization: `Bot ${bot_token}`,
            },
          }
        )
        totalMembers = discordResponse.data.approximate_member_count || 0
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          fastify.log.error(
            {
              message: error.message,
              code: error.code,
              status: error.response?.status,
            },
            'Erro ao buscar membros do Discord'
          )
        } else {
          fastify.log.error({ err: safe_error_details(error) }, 'Erro ao buscar membros do Discord')
        }
      }

      return reply.send({
        totalMembers,
        moderationActions7d,
        moderationActions30d,
        activeGiveaways,
        totalGiveaways,
        bannedWords,
        recentActions,
        actionsByType,
      })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to build guild stats')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
