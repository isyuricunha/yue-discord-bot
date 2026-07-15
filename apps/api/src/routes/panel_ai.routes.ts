import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import { prisma } from '@yuebot/database'

import { CONFIG } from '../config'
import { is_guild_admin } from '../internal/bot_internal_api'
import {
  complete_panel_ai,
  normalize_panel_ai_runtime,
  type panel_ai_completion_input,
  type panel_ai_dependencies,
  type panel_ai_message,
  type panel_ai_runtime_event,
} from '../services/panel_ai'
import { custom_provider_is_configured } from '../services/custom_provider'
import { build_panel_context, type panel_context_data } from '../services/panel_context'
import { ConversationStore } from '../services/conversation_store'
import { load_custom_provider_system_prompt } from '../services/prompt_loader'
import { can_access_guild } from '../utils/guild_access'
import { safe_error_details } from '../utils/safe_error'
import { find_panel_ai_page, type panel_ai_page_key } from '@yuebot/shared'
import { load_panel_module_context, type anti_raid_module_record, type preload_result } from '../services/panel_module_context'

const MAX_MESSAGE_LENGTH = 4_000

type panel_ai_db = {
  botSettings: Pick<typeof prisma.botSettings, 'findUnique'>
  guild: Pick<typeof prisma.guild, 'findUnique'>
  guildAntiRaidConfig: Pick<typeof prisma.guildAntiRaidConfig, 'findUnique'>
}

type admin_check = (guildId: string, userId: string, log: FastifyBaseLogger) => Promise<{ isAdmin: boolean }>

type complete_panel_ai_fn = (
  input: panel_ai_completion_input,
  dependencies?: panel_ai_dependencies,
) => Promise<string>

type base_guild_config = {
  welcomeChannelId?: unknown
  wordFilterEnabled?: unknown
  aiModerationEnabled?: unknown
}

function get_boolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function get_anti_raid_context(preload: preload_result<anti_raid_module_record>): panel_context_data['antiRaid'] {
  if (preload.state === 'failed' || preload.value === null) return null

  return {
    enabled: get_boolean(preload.value.enabled),
    raidActive: get_boolean(preload.value.raidActive),
    locked: get_boolean(preload.value.locked),
  }
}

export type panel_ai_route_deps = {
  db: panel_ai_db
  store: ConversationStore
  isGuildAdmin: admin_check
  completePanelAi: complete_panel_ai_fn
  mistralAgentId?: string
  mistralApiKeyConfigured?: boolean
  customProviderIsConfigured: () => boolean
  loadCustomProviderPersona: (promptPath?: string) => string
}

function conversation_key(guildId: string, userId: string) {
  return `${guildId}:${userId}`
}

function parse_message(body: unknown) {
  const message = (body as { message?: unknown } | null)?.message
  if (typeof message !== 'string') return null
  const trimmed = message.trim()
  return trimmed && trimmed.length <= MAX_MESSAGE_LENGTH ? trimmed : null
}

function parse_page_context(body: unknown): { pageKey: panel_ai_page_key } | null {
  const pageContext = (body as { pageContext?: unknown } | null)?.pageContext
  if (!pageContext || typeof pageContext !== 'object') return null
  const pageKey = (pageContext as { pageKey?: unknown }).pageKey
  if (typeof pageKey !== 'string') return null
  const definition = find_panel_ai_page(pageKey)
  if (!definition) return null
  return { pageKey: definition.key }
}

async function assert_guild_access(
  isGuildAdmin: admin_check,
  request: FastifyRequest,
  reply: FastifyReply,
  guildId: string,
): Promise<boolean> {
  const user = request.user
  if (!can_access_guild(user, guildId)) {
    reply.code(403).send({ error: 'Forbidden' })
    return false
  }
  if (!user.isOwner) {
    const { isAdmin } = await isGuildAdmin(guildId, user.userId, request.log)
    if (!isAdmin) {
      reply.code(403).send({ error: 'Forbidden' })
      return false
    }
  }
  return true
}

export function createPanelAiRoutes(overrides: Partial<panel_ai_route_deps> = {}): FastifyPluginAsync {
  const deps: panel_ai_route_deps = {
    db: overrides.db ?? prisma,
    store: overrides.store ?? new ConversationStore(),
    isGuildAdmin: overrides.isGuildAdmin ?? is_guild_admin,
    completePanelAi: overrides.completePanelAi ?? complete_panel_ai,
    mistralAgentId: overrides.mistralAgentId,
    mistralApiKeyConfigured: overrides.mistralApiKeyConfigured,
    customProviderIsConfigured: overrides.customProviderIsConfigured ?? custom_provider_is_configured,
    loadCustomProviderPersona: overrides.loadCustomProviderPersona ?? ((promptPath?: string) => load_custom_provider_system_prompt(promptPath ?? '')),
  }

  return async function panelAiRoutes(fastify: FastifyInstance) {
    fastify.post('/guilds/:guildId/panel-ai/chat', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const { guildId } = request.params as { guildId: string }
      const user = request.user
      const message = parse_message(request.body)
      const pageContext = parse_page_context(request.body)
      if (!guildId || !message) return reply.code(400).send({ error: 'Invalid message' })
      if (!(await assert_guild_access(deps.isGuildAdmin, request, reply, guildId))) return

      const pageKey = pageContext?.pageKey

      const [settings, guild] = await Promise.all([
        deps.db.botSettings.findUnique({ where: { id: 'global' } }),
        deps.db.guild.findUnique({
          where: { id: guildId },
          select: {
            id: true,
            name: true,
            config: { select: { welcomeChannelId: true, wordFilterEnabled: true, aiModerationEnabled: true } },
          },
        }),
      ])
      if (!guild) return reply.code(404).send({ error: 'Guild not found' })

      const moduleContextResult = await load_panel_module_context({
        pageKey,
        guildId,
        db: deps.db,
        logger: request.log,
      })

      const normalized_runtime = normalize_panel_ai_runtime({
        provider: settings?.panelAiProvider,
        customModel: settings?.customProviderModel,
        customReasoningMode: settings?.customProviderReasoningMode,
        fallbackEnabled: settings?.panelAiFallbackEnabled,
      })
      const version = settings?.panelAiConversationVersion ?? 1
      const key = conversation_key(guildId, user.userId)
      const history = deps.store.get(key, version)

      const context_data: panel_context_data = {
        guild: {
          id: guild.id,
          name: guild.name,
          config: guild.config
            ? {
                welcomeChannelId: guild.config.welcomeChannelId,
                wordFilterEnabled: get_boolean((guild.config as base_guild_config).wordFilterEnabled),
                aiModerationEnabled: get_boolean((guild.config as base_guild_config).aiModerationEnabled),
              }
            : null,
        },
        antiRaid: get_anti_raid_context(moduleContextResult.antiRaid),
        page: pageContext ? find_panel_ai_page(pageContext.pageKey) : null,
        moduleContext: moduleContextResult.moduleContext,
      }
      const context = build_panel_context(context_data)

      const can_use_custom =
        normalized_runtime.provider === 'custom' ||
        (normalized_runtime.fallbackEnabled &&
          deps.customProviderIsConfigured() &&
          Boolean(normalized_runtime.customModel))

      const persona = can_use_custom ? deps.loadCustomProviderPersona(CONFIG.panelAi.promptPath) : ''

      const messages_for_provider: panel_ai_message[] = [
        ...history,
        { role: 'user', content: message },
      ]

      try {
        const response = await deps.completePanelAi(
          {
            runtime: normalized_runtime,
            persona,
            context,
            messages: messages_for_provider,
          },
          {
            mistralAgentId: deps.mistralAgentId,
            mistralApiKeyConfigured: deps.mistralApiKeyConfigured,
            customProviderConfigured: deps.customProviderIsConfigured(),
            logEvent: (event: panel_ai_runtime_event) => {
              try {
                request.log.info(
                  {
                    runtimeEvent: {
                      type: event.type,
                      primaryProvider: event.primaryProvider,
                      fallbackProvider: event.fallbackProvider,
                      category: event.category,
                      statusCode: event.statusCode,
                      modelId: event.modelId,
                      guildId,
                      success: event.success,
                    },
                  },
                  'Panel AI runtime event',
                )
              } catch {
                // Ignore logger errors
              }
            },
          },
        )
        deps.store.set(key, version, [
          ...history,
          { role: 'user' as const, content: message },
          { role: 'assistant' as const, content: response },
        ])
        return reply.send({ success: true, response, actions: [] })
      } catch (error: unknown) {
        request.log.warn({ err: safe_error_details(error), guildId }, 'Panel AI chat failed')
        return reply.code(502).send({ error: 'Panel assistant is unavailable' })
      }
    })

    fastify.get('/guilds/:guildId/panel-ai/history', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const { guildId } = request.params as { guildId: string }
      const user = request.user
      if (!guildId) return reply.code(400).send({ error: 'Invalid guild' })
      if (!(await assert_guild_access(deps.isGuildAdmin, request, reply, guildId))) return

      const settings = await deps.db.botSettings.findUnique({ where: { id: 'global' } })
      const version = settings?.panelAiConversationVersion ?? 1
      const key = conversation_key(guildId, user.userId)
      const messages = deps.store.get(key, version)
      return reply.send({
        success: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      })
    })

    fastify.delete('/guilds/:guildId/panel-ai/history', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      const { guildId } = request.params as { guildId: string }
      const user = request.user
      if (!guildId) return reply.code(400).send({ error: 'Invalid guild' })
      if (!(await assert_guild_access(deps.isGuildAdmin, request, reply, guildId))) return

      const key = conversation_key(guildId, user.userId)
      deps.store.delete(key)
      return reply.send({ success: true })
    })
  }
}

export const panelAiRoutes = createPanelAiRoutes()
