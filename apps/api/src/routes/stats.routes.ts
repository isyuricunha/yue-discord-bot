import { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import { can_access_guild } from '../utils/guild_access'
import { safe_error_details } from '../utils/safe_error'
import { get_guild_counts, is_guild_admin, get_bot_stats } from '../internal/bot_internal_api'

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

      // Generate 7-days chart data
      const dateLabels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split('T')[0]
      })

      const chartDataMap = new Map<string, { date: string, newMembers: number, moderationActions: number, economy: number }>()
      dateLabels.forEach(date => {
        // Will format date as "DD/MM" for UI
        const [, mm, dd] = date.split('-')
        chartDataMap.set(date, { date: `${dd}/${mm}`, newMembers: 0, moderationActions: 0, economy: 0 })
      })

      // 1. Bin moderation actions
      const recentModLogs = await prisma.modLog.findMany({
        where: { guildId, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
      })
      recentModLogs.forEach(log => {
        const dStr = log.createdAt.toISOString().split('T')[0]
        if (chartDataMap.has(dStr)) chartDataMap.get(dStr)!.moderationActions++
      })

      // 2. Bin new members
      const recentMembers = await prisma.guildMember.findMany({
        where: { guildId, joinedAt: { gte: sevenDaysAgo } },
        select: { joinedAt: true }
      })
      recentMembers.forEach(member => {
        const dStr = member.joinedAt.toISOString().split('T')[0]
        if (chartDataMap.has(dStr)) chartDataMap.get(dStr)!.newMembers++
      })

      // 3. Bin economy transactions
      const recentEconomy = await prisma.luazinhaTransaction.findMany({
        where: { guildId, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
      })
      recentEconomy.forEach(tx => {
        const dStr = tx.createdAt.toISOString().split('T')[0]
        if (chartDataMap.has(dStr)) chartDataMap.get(dStr)!.economy++
      })

      const chartData = Array.from(chartDataMap.values())

      // Fetch total members from Bot internal API (bot token stays confined to the bot process)
      let totalMembers = 0
      try {
        const data = await get_guild_counts(guildId, request.log)
        totalMembers = typeof data.approximateMemberCount === 'number' ? data.approximateMemberCount : 0
      } catch (error: unknown) {
        fastify.log.error({ err: safe_error_details(error) }, 'Erro ao buscar membros do bot internal API')
      }

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
