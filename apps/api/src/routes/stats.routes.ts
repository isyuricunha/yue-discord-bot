import { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import { can_access_guild } from '../utils/guild_access'
import { safe_error_details } from '../utils/safe_error'
import { get_guild_counts, is_guild_admin, get_bot_stats } from '../internal/bot_internal_api'
import { summarize_giveaways, summarize_recent_activity } from './stats.logic'

export async function statsRoutes(fastify: FastifyInstance) {
  // Public endpoint to get global bot stats (for login page)
  fastify.get('/bot/stats', async (request, reply) => {
    try {
      const stats = await get_bot_stats(request.log)

      return reply.send({
        success: true,
        servers: stats.servers,
        users: stats.users,
      })
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to get bot stats')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
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

    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
    }

    try {
      // Get total members (from Discord API or cache)
      const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        select: { id: true },
      })

      if (!guild) {
        return reply.code(404).send({ error: 'Guild not found' })
      }

      const now = new Date()
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const guild_counts_promise = get_guild_counts(guildId, request.log).catch((error: unknown) => {
        fastify.log.error({ err: safe_error_details(error) }, 'Erro ao buscar membros do bot internal API')
        return null
      })

      const [
        moderationActions30d,
        giveawayGroups,
        config,
        recentActions,
        recentModLogs,
        recentMembers,
        recentEconomy,
        guildCounts,
      ] = await Promise.all([
        prisma.modLog.count({
          where: {
            guildId,
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.giveaway.groupBy({
          by: ['ended', 'cancelled'],
          where: { guildId },
          _count: { id: true },
        }),
        prisma.guildConfig.findUnique({
          where: { guildId },
          select: { bannedWords: true },
        }),
        prisma.modLog.findMany({
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
        }),
        prisma.modLog.findMany({
          where: { guildId, createdAt: { gte: sevenDaysAgo } },
          select: { action: true, createdAt: true },
        }),
        prisma.guildMember.findMany({
          where: { guildId, joinedAt: { gte: sevenDaysAgo } },
          select: { joinedAt: true },
        }),
        prisma.luazinhaTransaction.findMany({
          where: { guildId, createdAt: { gte: sevenDaysAgo } },
          select: { createdAt: true },
        }),
        guild_counts_promise,
      ])

      const bannedWords = Array.isArray(config?.bannedWords) ? config.bannedWords.length : 0
      const { activeGiveaways, totalGiveaways } = summarize_giveaways(giveawayGroups)
      const {
        moderationActions7d,
        actionsByType,
        chartData,
      } = summarize_recent_activity({
        now,
        moderationLogs: recentModLogs,
        members: recentMembers,
        economyTransactions: recentEconomy,
      })
      const totalMembers = typeof guildCounts?.approximateMemberCount === 'number'
        ? guildCounts.approximateMemberCount
        : 0

      return reply.send({
        success: true,
        totalMembers,
        moderationActions7d,
        moderationActions30d,
        activeGiveaways,
        totalGiveaways,
        bannedWords,
        recentActions,
        actionsByType,
        chartData,
      })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to build guild stats')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
