import { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@yuebot/database'
import { safe_error_details } from '../utils/safe_error'
import { can_access_guild } from '../utils/guild_access'
import { is_guild_admin } from '../internal/bot_internal_api'

function escape_csv_cell(input: unknown): string {
  const raw = input === null || input === undefined ? '' : String(input)

  // Mitigate CSV injection in spreadsheet apps.
  const injection_prefixes = ['=', '+', '-', '@']
  const needs_injection_mitigation = raw.length > 0 && injection_prefixes.includes(raw[0]!)

  const safe = needs_injection_mitigation ? `'${raw}` : raw
  const escaped = safe.replace(/"/g, '""')
  return `"${escaped}"`
}

function clamp_take(input: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(String(input ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

export async function exportRoutes(fastify: FastifyInstance) {
  // Export giveaway entries
  fastify.get('/guilds/:guildId/giveaways/:giveawayId/export', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, giveawayId } = request.params as { guildId: string; giveawayId: string }
    const { format = 'json' } = request.query as { format?: 'json' | 'csv' }
    const user = request.user

    if (format !== 'json' && format !== 'csv') {
      return reply.code(400).send({ error: 'Invalid format' })
    }

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
      const giveaway = await prisma.giveaway.findFirst({
        where: {
          guildId,
          OR: [{ id: giveawayId }, { publicId: giveawayId }],
        },
        include: {
          entries: {
            orderBy: { createdAt: 'asc' },
          },
          winners: true,
        },
      })

      if (!giveaway) {
        return reply.code(404).send({ error: 'Giveaway not found' })
      }

      if (format === 'csv') {
        // Generate CSV
        let csv = 'ID,Usuário,Discord ID,Escolhas,Desqualificado,Data Participação,Vencedor,Prêmio\n'
        
        giveaway.entries.forEach(entry => {
          const winner = giveaway.winners.find(w => w.userId === entry.userId)
          const choices = entry.choices 
            ? (entry.choices as string[]).join('; ')
            : 'N/A'
          
          csv += [
            escape_csv_cell(entry.id),
            escape_csv_cell(entry.username),
            escape_csv_cell(entry.userId),
            escape_csv_cell(choices),
            escape_csv_cell(entry.disqualified ? 'Sim' : 'Não'),
            escape_csv_cell(entry.createdAt.toISOString()),
            escape_csv_cell(winner ? 'Sim' : 'Não'),
            escape_csv_cell(winner?.prize || 'N/A'),
          ].join(',') + '\n'
        })

        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="sorteio-${giveawayId}-participantes.csv"`)
          .send(csv)
      } else {
        // Return JSON
        const data = {
          giveaway: {
            id: giveaway.id,
            title: giveaway.title,
            description: giveaway.description,
            maxWinners: giveaway.maxWinners,
            format: giveaway.format,
            endsAt: giveaway.endsAt,
            ended: giveaway.ended,
            cancelled: giveaway.cancelled,
          },
          entries: giveaway.entries.map(entry => ({
            id: entry.id,
            username: entry.username,
            userId: entry.userId,
            choices: entry.choices,
            disqualified: entry.disqualified,
            createdAt: entry.createdAt,
          })),
          winners: giveaway.winners.map(winner => ({
            id: winner.id,
            username: winner.username,
            userId: winner.userId,
            prize: winner.prize,
            createdAt: winner.createdAt,
          })),
          exportedAt: new Date().toISOString(),
        }

        return reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="sorteio-${giveawayId}-participantes.json"`)
          .send(data)
      }
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to export giveaway entries')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Export moderation logs
  fastify.get('/guilds/:guildId/modlogs/export', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { format = 'json', action, limit = '1000' } = request.query as { 
      format?: 'json' | 'csv'
      action?: string
      limit?: string
    }
    const user = request.user

    if (format !== 'json' && format !== 'csv') {
      return reply.code(400).send({ error: 'Invalid format' })
    }

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
      const where: Prisma.ModLogWhereInput = { guildId }
      
      if (action) {
        where.action = action
      }

      const take = clamp_take(limit, 1000, 5000)

      const modlogs = await prisma.modLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      })

      if (format === 'csv') {
        // Generate CSV
        let csv = 'ID,Ação,Usuário ID,Moderador ID,Razão,Duração,Data\n'
        
        modlogs.forEach(log => {
          csv += [
            escape_csv_cell(log.id),
            escape_csv_cell(log.action),
            escape_csv_cell(log.userId),
            escape_csv_cell(log.moderatorId),
            escape_csv_cell(log.reason || 'N/A'),
            escape_csv_cell(log.duration || 'N/A'),
            escape_csv_cell(log.createdAt.toISOString()),
          ].join(',') + '\n'
        })

        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="modlogs-${guildId}.csv"`)
          .send(csv)
      } else {
        // Return JSON
        const data = {
          guildId,
          totalLogs: modlogs.length,
          logs: modlogs,
          exportedAt: new Date().toISOString(),
        }

        return reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="modlogs-${guildId}.json"`)
          .send(data)
      }
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to export modlogs')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
