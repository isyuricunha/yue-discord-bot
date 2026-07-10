import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'

import { is_guild_admin } from '../internal/bot_internal_api'
import { complete_panel_ai, type panel_ai_message } from '../services/panel_ai'
import { can_access_guild } from '../utils/guild_access'
import { safe_error_details } from '../utils/safe_error'

const conversation_store = new Map<string, { version: number; messages: panel_ai_message[]; expiresAt: number }>()
const CONVERSATION_TTL_MS = 30 * 60 * 1000
const MAX_MESSAGE_LENGTH = 4_000
const MAX_HISTORY_MESSAGES = 12

function conversation_key(guildId: string, userId: string) {
  return `${guildId}:${userId}`
}

function parse_message(body: unknown) {
  const message = (body as { message?: unknown } | null)?.message
  if (typeof message !== 'string') return null
  const trimmed = message.trim()
  return trimmed && trimmed.length <= MAX_MESSAGE_LENGTH ? trimmed : null
}

export async function panelAiRoutes(fastify: FastifyInstance) {
  fastify.post('/guilds/:guildId/panel-ai/chat', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const user = request.user
    const message = parse_message(request.body)
    if (!guildId || !message) return reply.code(400).send({ error: 'Invalid message' })
    if (!can_access_guild(user, guildId)) return reply.code(403).send({ error: 'Forbidden' })
    if (!user.isOwner) {
      const { isAdmin } = await is_guild_admin(guildId, user.userId, request.log)
      if (!isAdmin) return reply.code(403).send({ error: 'Forbidden' })
    }

    const [settings, guild] = await Promise.all([
      prisma.botSettings.findUnique({ where: { id: 'global' } }),
      prisma.guild.findUnique({ where: { id: guildId }, select: { id: true, name: true, config: { select: { welcomeChannelId: true, wordFilterEnabled: true, aiModerationEnabled: true } } } }),
    ])
    if (!guild) return reply.code(404).send({ error: 'Guild not found' })

    const version = settings?.panelAiConversationVersion ?? 1
    const key = conversation_key(guildId, user.userId)
    const cached = conversation_store.get(key)
    const history = cached && cached.version === version && cached.expiresAt > Date.now() ? cached.messages : []
    const contextual_message = [
      `Panel context: guild name is ${guild.name}.`,
      `Welcome is ${guild.config?.welcomeChannelId ? 'configured' : 'not configured'}, word filtering is ${guild.config?.wordFilterEnabled ? 'enabled' : 'disabled'}, and AI moderation is ${guild.config?.aiModerationEnabled ? 'enabled' : 'disabled'}.`,
      `User request: ${message}`,
    ].join(' ')

    try {
      const response = await complete_panel_ai({
        runtime: { provider: settings?.panelAiProvider === 'custom' ? 'custom' : 'mistral', customModel: settings?.customProviderModel ?? null },
        messages: [...history, { role: 'user', content: contextual_message }],
      })
      const messages = [...history, { role: 'user' as const, content: contextual_message }, { role: 'assistant' as const, content: response }].slice(-MAX_HISTORY_MESSAGES)
      conversation_store.set(key, { version, messages, expiresAt: Date.now() + CONVERSATION_TTL_MS })
      return reply.send({ success: true, response, actions: [] })
    } catch (error: unknown) {
      request.log.warn({ err: safe_error_details(error), guildId }, 'Panel AI chat failed')
      return reply.code(502).send({ error: 'Panel assistant is unavailable' })
    }
  })
}
