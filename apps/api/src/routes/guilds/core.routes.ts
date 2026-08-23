import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import {
  get_guild_channels,
  get_guild_roles,
  send_guild_message,
} from '../../internal/bot_internal_api'
import { public_error_message } from '../../utils/public_error'
import { safe_error_details } from '../../utils/safe_error'
import { requireGuildAccess, requireGuildAdmin } from './authorization'

export async function guildCoreRoutes(fastify: FastifyInstance) {
  const access = [fastify.authenticate, requireGuildAccess]
  const admin = [fastify.authenticate, requireGuildAdmin]

  const message_rate_limit = new Map<string, { count: number; windowStart: number }>()

  function can_send_message_now(user_id: string) {
    const window_ms = 10_000
    const max_per_window = 5
    const now = Date.now()

    if (message_rate_limit.size > 5000) {
      const prune_before = now - Math.max(window_ms * 10, 60 * 60 * 1000)
      for (const [key, entry] of message_rate_limit.entries()) {
        if (entry.windowStart < prune_before) message_rate_limit.delete(key)
      }

      if (message_rate_limit.size > 10000) {
        message_rate_limit.clear()
      }
    }

    const existing = message_rate_limit.get(user_id)
    if (!existing || now - existing.windowStart > window_ms) {
      message_rate_limit.set(user_id, { count: 1, windowStart: now })
      return true
    }

    if (existing.count >= max_per_window) return false
    existing.count += 1
    return true
  }

  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user = request.user

    if (user.isOwner) {
      const installed = await prisma.guild.findMany({
        select: { id: true, name: true, icon: true, ownerId: true, addedAt: true },
        orderBy: { name: 'asc' },
      })
      return { success: true, guilds: installed }
    }

    const guilds_data = user.guildsData || []
    const guild_ids = guilds_data.map((guild) => guild.id)
    if (guild_ids.length === 0) {
      return { success: true, guilds: [] }
    }

    const installed = await prisma.guild.findMany({
      where: { id: { in: guild_ids } },
      select: { id: true },
    })
    const installed_ids = new Set(installed.map((guild) => guild.id))

    return {
      success: true,
      guilds: guilds_data.filter((guild) => installed_ids.has(guild.id)),
    }
  })

  fastify.get('/:guildId/summary', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { id: true, name: true, icon: true },
    })

    if (!guild) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    return reply.send({ success: true, guild })
  })

  fastify.get('/:guildId', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: { config: true },
    })

    if (!guild) {
      return reply.code(404).send({ error: 'Guild not found' })
    }

    return reply.send({ success: true, guild })
  })

  fastify.post('/:guildId/messages', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const body = request.body as { channelId?: string; content?: string }

    if (!body?.channelId || typeof body.channelId !== 'string') {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    const content = typeof body.content === 'string' ? body.content : ''
    if (!content.trim()) {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    if (content.length > 2000) {
      return reply.code(400).send({ error: 'Message too long' })
    }

    if (!can_send_message_now(request.user.userId)) {
      return reply.code(429).send({ error: 'Rate limited' })
    }

    const result = await send_guild_message(guildId, body.channelId, content, request.log)
    return reply.send({ success: true, messageId: result.messageId })
  })

  fastify.get('/:guildId/channels', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    try {
      const data = await get_guild_channels(guildId, request.log)
      return reply.send({ success: true, channels: data.channels })
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to fetch channels from bot internal API')
      return reply.code(502).send({
        error: public_error_message(fastify, 'Failed to fetch channels', 'Bad gateway'),
      })
    }
  })

  fastify.get('/:guildId/roles', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    try {
      const data = await get_guild_roles(guildId, request.log)
      return reply.send({ success: true, roles: data.roles })
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to fetch roles from bot internal API')
      return reply.code(502).send({
        error: public_error_message(fastify, 'Failed to fetch roles', 'Bad gateway'),
      })
    }
  })
}
