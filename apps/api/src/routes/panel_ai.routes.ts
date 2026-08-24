import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import { prisma } from '@yuebot/database'
import {
  find_panel_ai_page,
  type panel_ai_action,
  type panel_ai_page_context,
  type panel_ai_page_key,
  type panel_ai_sensitive_request,
  type panel_ai_sensitive_scope,
} from '@yuebot/shared'

import { CONFIG } from '../config'
import { is_guild_admin } from '../internal/bot_internal_api'
import { createGuildRouteAuthorization } from './guilds/authorization'
import {
  complete_panel_ai,
  normalize_panel_ai_runtime,
  type panel_ai_completion_input,
  type panel_ai_dependencies,
  type panel_ai_message,
  type panel_ai_runtime_event,
} from '../services/panel_ai'
import {
  complete_panel_ai_stream,
  type panel_ai_stream_dependencies,
} from '../services/panel_ai_stream'
import { custom_provider_is_configured } from '../services/custom_provider'
import { build_panel_context, type panel_context_data } from '../services/panel_context'
import { ConversationStore } from '../services/conversation_store'
import { PanelConversationQueue, panel_conversation_queue } from '../services/panel_conversation_queue'
import {
  PanelAiProtocolStreamFilter,
  parse_panel_ai_output,
} from '../services/panel_ai_protocol'
import {
  available_sensitive_scopes,
  load_panel_sensitive_context,
  PanelSensitiveContextStore,
  panel_sensitive_context_store,
  type panel_sensitive_context_db,
} from '../services/panel_sensitive_context'
import { load_custom_provider_system_prompt } from '../services/prompt_loader'
import {
  load_panel_module_context,
  type anti_raid_module_record,
  type panel_module_db,
  type preload_result,
} from '../services/panel_module_context'
import { safe_error_details } from '../utils/safe_error'

const MAX_MESSAGE_LENGTH = 4_000
const MAX_ROUTE_PARAM_LENGTH = 128

type panel_ai_db = panel_module_db & panel_sensitive_context_db & {
  botSettings: Pick<typeof prisma.botSettings, 'findUnique'>
}

type admin_check = (guildId: string, userId: string, log: FastifyBaseLogger) => Promise<{ isAdmin: boolean }>
type guild_exists_check = (guildId: string) => Promise<boolean>

type complete_panel_ai_fn = (
  input: panel_ai_completion_input,
  dependencies?: panel_ai_dependencies,
) => Promise<string>

type complete_panel_ai_stream_fn = (
  input: panel_ai_completion_input,
  dependencies: panel_ai_stream_dependencies,
  onDelta: (delta: string) => void,
) => Promise<string>

type base_guild_config = {
  welcomeChannelId?: unknown
  wordFilterEnabled?: unknown
  aiModerationEnabled?: unknown
}

export type panel_ai_route_deps = {
  db: panel_ai_db
  store: ConversationStore
  queue: PanelConversationQueue
  sensitiveStore: PanelSensitiveContextStore
  guildExists: guild_exists_check
  isGuildAdmin: admin_check
  completePanelAi: complete_panel_ai_fn
  completePanelAiStream: complete_panel_ai_stream_fn
  loadSensitiveContext: typeof load_panel_sensitive_context
  mistralAgentId?: string
  mistralApiKeyConfigured?: boolean
  customProviderIsConfigured: () => boolean
  loadCustomProviderPersona: (promptPath?: string) => string
}

type turn_environment = {
  version: number
  runtime: ReturnType<typeof normalize_panel_ai_runtime>
  persona: string
  context: string
  sensitiveEnabled: boolean
  pageContext: panel_ai_page_context | null
}

type turn_result = {
  response: string
  actions: panel_ai_action[]
  sensitiveRequest?: panel_ai_sensitive_request
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

function conversation_key(guildId: string, userId: string) {
  return `${guildId}:${userId}`
}

function parse_message(body: unknown) {
  const message = (body as { message?: unknown } | null)?.message
  if (typeof message !== 'string') return null
  const trimmed = message.trim()
  return trimmed && trimmed.length <= MAX_MESSAGE_LENGTH ? trimmed : null
}

function parse_page_context(body: unknown): panel_ai_page_context | null {
  const rawContext = (body as { pageContext?: unknown } | null)?.pageContext
  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) return null
  const pageKey = (rawContext as { pageKey?: unknown }).pageKey
  if (typeof pageKey !== 'string') return null
  const definition = find_panel_ai_page(pageKey)
  if (!definition) return null

  const expectedParams = new Set(
    [...definition.routePattern.matchAll(/:([A-Za-z0-9_]+)/g)]
      .map((match) => match[1])
      .filter((name) => name !== 'guildId'),
  )
  const rawParams = (rawContext as { routeParams?: unknown }).routeParams
  const routeParams: Record<string, string> = {}

  if (rawParams !== undefined) {
    if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) return null
    for (const [key, value] of Object.entries(rawParams as Record<string, unknown>)) {
      if (!expectedParams.has(key)) return null
      if (typeof value !== 'string') return null
      const trimmed = value.trim()
      if (!trimmed || trimmed.length > MAX_ROUTE_PARAM_LENGTH) return null
      routeParams[key] = trimmed
    }
  }

  return {
    pageKey: definition.key as panel_ai_page_key,
    ...(Object.keys(routeParams).length > 0 ? { routeParams } : {}),
  }
}

function runtime_dependencies(
  deps: panel_ai_route_deps,
  guildId: string,
  request: FastifyRequest,
): panel_ai_stream_dependencies {
  return {
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
        // Logger failures must not change assistant behavior.
      }
    },
  }
}

async function load_turn_environment(
  deps: panel_ai_route_deps,
  request: FastifyRequest,
  guildId: string,
  pageContext: panel_ai_page_context | null,
): Promise<turn_environment | null> {
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
  if (!guild) return null

  const moduleContextResult = await load_panel_module_context({
    pageKey: pageContext?.pageKey,
    guildId,
    db: deps.db,
    logger: request.log,
  })

  const runtime = normalize_panel_ai_runtime({
    provider: settings?.panelAiProvider,
    customModel: settings?.customProviderModel,
    customReasoningMode: settings?.customProviderReasoningMode,
    fallbackEnabled: settings?.panelAiFallbackEnabled,
  })
  const version = settings?.panelAiConversationVersion ?? 1
  const sensitiveEnabled = settings?.panelAiSensitiveContextEnabled === true
  const page = pageContext ? find_panel_ai_page(pageContext.pageKey) : null

  const context = build_panel_context({
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
    page,
    moduleContext: moduleContextResult.moduleContext,
    sensitiveContext: {
      enabled: sensitiveEnabled,
      availableScopes: sensitiveEnabled ? available_sensitive_scopes(pageContext) : [],
    },
  })

  const canUseCustom =
    runtime.provider === 'custom' ||
    (runtime.fallbackEnabled && deps.customProviderIsConfigured() && Boolean(runtime.customModel))
  const persona = canUseCustom ? deps.loadCustomProviderPersona(CONFIG.panelAi.promptPath) : ''

  return { version, runtime, persona, context, sensitiveEnabled, pageContext }
}

async function create_sensitive_request(
  deps: panel_ai_route_deps,
  request: FastifyRequest,
  guildId: string,
  userId: string,
  environment: turn_environment,
  scope: panel_ai_sensitive_scope | null,
): Promise<panel_ai_sensitive_request | null> {
  if (!scope || !environment.sensitiveEnabled || !environment.pageContext) return null
  try {
    const context = await deps.loadSensitiveContext({
      db: deps.db,
      guildId,
      pageContext: environment.pageContext,
      scope,
    })
    if (!context) return null
    return deps.sensitiveStore.create({
      guildId,
      userId,
      conversationVersion: environment.version,
      context,
    })
  } catch {
    request.log.warn(
      { guildId, userId, scope, error: 'sensitive context read failed' },
      'Failed to prepare Panel AI sensitive context preview',
    )
    return null
  }
}

function normalize_visible_response(response: string) {
  return response.trim() || 'Posso te ajudar com as opções disponíveis nesta página.'
}

async function run_json_chat_turn(
  deps: panel_ai_route_deps,
  request: FastifyRequest,
  guildId: string,
  message: string,
  pageContext: panel_ai_page_context | null,
): Promise<turn_result | null> {
  const userId = request.user.userId
  const environment = await load_turn_environment(deps, request, guildId, pageContext)
  if (!environment) return null

  const key = conversation_key(guildId, userId)
  const history = deps.store.get(key, environment.version)
  const messages: panel_ai_message[] = [...history, { role: 'user', content: message }]
  const raw = await deps.completePanelAi(
    {
      runtime: environment.runtime,
      persona: environment.persona,
      context: environment.context,
      messages,
    },
    runtime_dependencies(deps, guildId, request),
  )
  const parsed = parse_panel_ai_output(raw)
  const response = normalize_visible_response(parsed.response)

  deps.store.set(key, environment.version, [
    ...history,
    { role: 'user', content: message },
    { role: 'assistant', content: response },
  ])

  const sensitiveRequest = await create_sensitive_request(
    deps,
    request,
    guildId,
    userId,
    environment,
    parsed.sensitiveScope,
  )

  return {
    response,
    actions: parsed.actions,
    ...(sensitiveRequest ? { sensitiveRequest } : {}),
  }
}

function begin_sse(reply: FastifyReply) {
  reply.hijack()
  reply.raw.statusCode = 200
  reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
  reply.raw.setHeader('Connection', 'keep-alive')
  reply.raw.setHeader('X-Accel-Buffering', 'no')
  reply.raw.flushHeaders?.()
}

function write_sse(reply: FastifyReply, event: string, data: unknown) {
  if (reply.raw.destroyed || reply.raw.writableEnded) return
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

async function run_stream_chat_turn(
  deps: panel_ai_route_deps,
  request: FastifyRequest,
  reply: FastifyReply,
  guildId: string,
  message: string,
  pageContext: panel_ai_page_context | null,
) {
  const userId = request.user.userId
  const environment = await load_turn_environment(deps, request, guildId, pageContext)
  if (!environment) {
    return reply.code(404).send({ error: 'Guild not found' })
  }

  const key = conversation_key(guildId, userId)
  const history = deps.store.get(key, environment.version)
  const messages: panel_ai_message[] = [...history, { role: 'user', content: message }]
  const filter = new PanelAiProtocolStreamFilter()
  let raw = ''

  begin_sse(reply)
  try {
    raw = await deps.completePanelAiStream(
      {
        runtime: environment.runtime,
        persona: environment.persona,
        context: environment.context,
        messages,
      },
      runtime_dependencies(deps, guildId, request),
      (delta) => {
        raw += delta
        const visible = filter.push(delta)
        if (visible) write_sse(reply, 'delta', { text: visible })
      },
    )

    const tail = filter.finish()
    if (tail) write_sse(reply, 'delta', { text: tail })

    const parsed = parse_panel_ai_output(raw)
    const response = normalize_visible_response(parsed.response)
    deps.store.set(key, environment.version, [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: response },
    ])
    const sensitiveRequest = await create_sensitive_request(
      deps,
      request,
      guildId,
      userId,
      environment,
      parsed.sensitiveScope,
    )
    write_sse(reply, 'done', {
      response,
      actions: parsed.actions,
      ...(sensitiveRequest ? { sensitiveRequest } : {}),
    })
  } catch (error: unknown) {
    request.log.warn({ err: safe_error_details(error), guildId }, 'Panel AI streamed chat failed')
    write_sse(reply, 'error', { error: 'Panel assistant is unavailable' })
  } finally {
    if (!reply.raw.writableEnded) reply.raw.end()
  }
}

async function run_json_sensitive_confirmation(
  deps: panel_ai_route_deps,
  request: FastifyRequest,
  guildId: string,
  requestId: string,
): Promise<turn_result | 'missing' | 'disabled' | 'version-mismatch'> {
  const userId = request.user.userId
  const pending = deps.sensitiveStore.consume(requestId, guildId, userId)
  if (!pending) return 'missing'

  const environment = await load_turn_environment(deps, request, guildId, null)
  if (!environment?.sensitiveEnabled) return 'disabled'
  if (environment.version !== pending.conversationVersion) return 'version-mismatch'

  const key = conversation_key(guildId, userId)
  const history = deps.store.get(key, environment.version)
  const messages: panel_ai_message[] = [
    ...history,
    {
      role: 'user',
      content: 'I explicitly approve the one-time sensitive context shown by the panel. Continue the previous answer using only that approved context.',
    },
  ]
  const raw = await deps.completePanelAi(
    {
      runtime: environment.runtime,
      persona: environment.persona,
      context: `${environment.context}\n\n${pending.providerContext}`,
      messages,
    },
    runtime_dependencies(deps, guildId, request),
  )
  const parsed = parse_panel_ai_output(raw)
  const response = normalize_visible_response(parsed.response)
  deps.store.set(key, environment.version, [
    ...history,
    { role: 'assistant', content: response },
  ])
  return { response, actions: parsed.actions }
}

async function run_stream_sensitive_confirmation(
  deps: panel_ai_route_deps,
  request: FastifyRequest,
  reply: FastifyReply,
  guildId: string,
  requestId: string,
) {
  const userId = request.user.userId
  const pending = deps.sensitiveStore.consume(requestId, guildId, userId)
  if (!pending) return reply.code(404).send({ error: 'Sensitive context request not found or expired' })

  const environment = await load_turn_environment(deps, request, guildId, null)
  if (!environment?.sensitiveEnabled) return reply.code(409).send({ error: 'Sensitive context is disabled' })
  if (environment.version !== pending.conversationVersion) {
    return reply.code(409).send({ error: 'Conversation changed; request sensitive context again' })
  }

  const key = conversation_key(guildId, userId)
  const history = deps.store.get(key, environment.version)
  const messages: panel_ai_message[] = [
    ...history,
    {
      role: 'user',
      content: 'I explicitly approve the one-time sensitive context shown by the panel. Continue the previous answer using only that approved context.',
    },
  ]
  const filter = new PanelAiProtocolStreamFilter()
  let raw = ''
  begin_sse(reply)

  try {
    raw = await deps.completePanelAiStream(
      {
        runtime: environment.runtime,
        persona: environment.persona,
        context: `${environment.context}\n\n${pending.providerContext}`,
        messages,
      },
      runtime_dependencies(deps, guildId, request),
      (delta) => {
        raw += delta
        const visible = filter.push(delta)
        if (visible) write_sse(reply, 'delta', { text: visible })
      },
    )
    const tail = filter.finish()
    if (tail) write_sse(reply, 'delta', { text: tail })
    const parsed = parse_panel_ai_output(raw)
    const response = normalize_visible_response(parsed.response)
    deps.store.set(key, environment.version, [
      ...history,
      { role: 'assistant', content: response },
    ])
    write_sse(reply, 'done', { response, actions: parsed.actions })
  } catch (error: unknown) {
    request.log.warn({ err: safe_error_details(error), guildId }, 'Panel AI sensitive confirmation failed')
    write_sse(reply, 'error', { error: 'Panel assistant is unavailable' })
  } finally {
    if (!reply.raw.writableEnded) reply.raw.end()
  }
}

export function createPanelAiRoutes(overrides: Partial<panel_ai_route_deps> = {}): FastifyPluginAsync {
  const db = overrides.db ?? prisma
  const defaultGuildExists: guild_exists_check = async (guildId) => {
    const guild = await db.guild.findUnique({ where: { id: guildId }, select: { id: true } })
    return Boolean(guild)
  }
  const deps: panel_ai_route_deps = {
    db,
    store: overrides.store ?? new ConversationStore(),
    queue: overrides.queue ?? panel_conversation_queue,
    sensitiveStore: overrides.sensitiveStore ?? panel_sensitive_context_store,
    // An injected database is a complete route-test fixture unless the caller
    // also injects an explicit existence check. Production uses the real DB
    // lookup below, so requireGuildAdmin still enforces installed guilds.
    guildExists: overrides.guildExists ?? (overrides.db ? async () => true : defaultGuildExists),
    isGuildAdmin: overrides.isGuildAdmin ?? is_guild_admin,
    completePanelAi: overrides.completePanelAi ?? complete_panel_ai,
    completePanelAiStream: overrides.completePanelAiStream ?? complete_panel_ai_stream,
    loadSensitiveContext: overrides.loadSensitiveContext ?? load_panel_sensitive_context,
    mistralAgentId: overrides.mistralAgentId,
    mistralApiKeyConfigured: overrides.mistralApiKeyConfigured,
    customProviderIsConfigured: overrides.customProviderIsConfigured ?? custom_provider_is_configured,
    loadCustomProviderPersona:
      overrides.loadCustomProviderPersona ??
      ((promptPath?: string) => load_custom_provider_system_prompt(promptPath ?? '')),
  }

  const authorization = createGuildRouteAuthorization({
    guildExists: deps.guildExists,
    isGuildAdmin: deps.isGuildAdmin,
  })
  const admin = (fastify: FastifyInstance) => [fastify.authenticate, authorization.requireGuildAdmin]

  return async function panelAiRoutes(fastify: FastifyInstance) {
    fastify.post('/guilds/:guildId/panel-ai/chat', { preHandler: admin(fastify) }, async (request, reply) => {
      const { guildId } = request.params as { guildId: string }
      const message = parse_message(request.body)
      if (!guildId || !message) return reply.code(400).send({ error: 'Invalid message' })
      const pageContext = parse_page_context(request.body)
      const key = conversation_key(guildId, request.user.userId)

      try {
        const result = await deps.queue.run(key, () => run_json_chat_turn(deps, request, guildId, message, pageContext))
        if (!result) return reply.code(404).send({ error: 'Guild not found' })
        return reply.send({ success: true, ...result })
      } catch (error: unknown) {
        request.log.warn({ err: safe_error_details(error), guildId }, 'Panel AI chat failed')
        return reply.code(502).send({ error: 'Panel assistant is unavailable' })
      }
    })

    fastify.post('/guilds/:guildId/panel-ai/chat/stream', { preHandler: admin(fastify) }, async (request, reply) => {
      const { guildId } = request.params as { guildId: string }
      const message = parse_message(request.body)
      if (!guildId || !message) return reply.code(400).send({ error: 'Invalid message' })
      const pageContext = parse_page_context(request.body)
      const key = conversation_key(guildId, request.user.userId)
      return deps.queue.run(key, () => run_stream_chat_turn(deps, request, reply, guildId, message, pageContext))
    })

    fastify.post('/guilds/:guildId/panel-ai/sensitive-context/:requestId/confirm', { preHandler: admin(fastify) }, async (request, reply) => {
      const { guildId, requestId } = request.params as { guildId: string; requestId: string }
      const key = conversation_key(guildId, request.user.userId)
      try {
        const result = await deps.queue.run(key, () => run_json_sensitive_confirmation(deps, request, guildId, requestId))
        if (result === 'missing') return reply.code(404).send({ error: 'Sensitive context request not found or expired' })
        if (result === 'disabled') return reply.code(409).send({ error: 'Sensitive context is disabled' })
        if (result === 'version-mismatch') return reply.code(409).send({ error: 'Conversation changed; request sensitive context again' })
        return reply.send({ success: true, ...result })
      } catch (error: unknown) {
        request.log.warn({ err: safe_error_details(error), guildId }, 'Panel AI sensitive confirmation failed')
        return reply.code(502).send({ error: 'Panel assistant is unavailable' })
      }
    })

    fastify.post('/guilds/:guildId/panel-ai/sensitive-context/:requestId/confirm/stream', { preHandler: admin(fastify) }, async (request, reply) => {
      const { guildId, requestId } = request.params as { guildId: string; requestId: string }
      const key = conversation_key(guildId, request.user.userId)
      return deps.queue.run(key, () => run_stream_sensitive_confirmation(deps, request, reply, guildId, requestId))
    })

    fastify.get('/guilds/:guildId/panel-ai/history', { preHandler: admin(fastify) }, async (request, reply) => {
      const { guildId } = request.params as { guildId: string }
      const key = conversation_key(guildId, request.user.userId)
      return deps.queue.run(key, async () => {
        const settings = await deps.db.botSettings.findUnique({ where: { id: 'global' } })
        const version = settings?.panelAiConversationVersion ?? 1
        const messages = deps.store.get(key, version)
        return reply.send({
          success: true,
          messages: messages.map((message) => ({ role: message.role, content: message.content })),
        })
      })
    })

    fastify.delete('/guilds/:guildId/panel-ai/history', { preHandler: admin(fastify) }, async (request, reply) => {
      const { guildId } = request.params as { guildId: string }
      const key = conversation_key(guildId, request.user.userId)
      return deps.queue.run(key, async () => {
        deps.store.delete(key)
        deps.sensitiveStore.delete_for_conversation(guildId, request.user.userId)
        return reply.send({ success: true })
      })
    })
  }
}

export const panelAiRoutes = createPanelAiRoutes()
