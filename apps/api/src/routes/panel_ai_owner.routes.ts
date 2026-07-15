import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'

import {
  custom_provider_is_configured,
  custom_provider_model,
  list_custom_provider_models,
  normalize_custom_provider_reasoning_mode,
  test_custom_provider_model,
  type custom_provider_reasoning_mode,
} from '../services/custom_provider'
import { normalize_panel_ai_runtime, panel_ai_runtime, test_panel_ai_runtime } from '../services/panel_ai'
import { is_owner } from '../utils/permissions'
import { safe_error_details } from '../utils/safe_error'

const ALLOWED_REASONING_MODES = new Set(['omit', 'none', 'minimal', 'low', 'medium', 'high'])

export type panel_ai_owner_deps = {
  db: {
    botSettings: {
      findUnique: (args: any) => Promise<any>
      upsert: (args: any) => Promise<any>
    }
    ownerActionLog: {
      create: (args: any) => Promise<any>
    }
  }
  isOwner: (userId: string) => boolean
  mistralPanelAgentIsConfigured: () => boolean
  customProviderIsConfigured: () => boolean
  listCustomProviderModels: () => Promise<custom_provider_model[]>
  testCustomProviderModel: (model: string, mode: custom_provider_reasoning_mode) => Promise<any>
  testPanelAiRuntime: (runtime: panel_ai_runtime, deps?: any) => Promise<any>
}

export function mistral_panel_agent_is_configured(): boolean {
  return Boolean(process.env.MISTRAL_PANEL_AGENT_ID?.trim()) && Boolean(process.env.MISTRAL_API_KEY?.trim())
}

function parse_settings(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const input = body as Record<string, unknown>
  const provider = input.panelProvider === 'mistral' || input.panelProvider === 'custom' ? input.panelProvider : null
  const customModel = typeof input.customModel === 'string' ? input.customModel.trim() : ''
  const sensitiveContextEnabled = typeof input.sensitiveContextEnabled === 'boolean' ? input.sensitiveContextEnabled : null
  const fallbackEnabled = typeof input.fallbackEnabled === 'boolean' ? input.fallbackEnabled : null
  const rawMode = input.customReasoningMode
  const customReasoningMode = typeof rawMode === 'string' && ALLOWED_REASONING_MODES.has(rawMode) ? (rawMode as custom_provider_reasoning_mode) : null

  if (!provider || sensitiveContextEnabled === null || fallbackEnabled === null || customReasoningMode === null) return null
  if (provider === 'custom' && !customModel) return null
  if (provider === 'mistral' && fallbackEnabled && !customModel) return null

  const effectiveFallbackEnabled = provider === 'custom' ? false : fallbackEnabled

  return {
    provider,
    customModel: customModel || null,
    customReasoningMode,
    fallbackEnabled: effectiveFallbackEnabled,
    sensitiveContextEnabled,
  }
}

function parse_test_request(body: unknown) {
  if (body === undefined || (typeof body === 'object' && body !== null && !Array.isArray(body) && Object.keys(body).length === 0)) {
    return { target: 'primary' as const }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const input = body as Record<string, unknown>
  const target = input.target

  if (target === 'primary') {
    return { target: 'primary' as const }
  }

  if (target === 'custom') {
    const customModel = typeof input.customModel === 'string' ? input.customModel.trim() : ''
    const rawMode = input.customReasoningMode
    const customReasoningMode =
      typeof rawMode === 'string' && ALLOWED_REASONING_MODES.has(rawMode)
        ? (rawMode as custom_provider_reasoning_mode)
        : null
    if (!customModel || customReasoningMode === null) return null
    return { target: 'custom' as const, customModel, customReasoningMode }
  }

  return null
}

function catalog(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}

export function createPanelAiOwnerRoutes(overrides: Partial<panel_ai_owner_deps> = {}) {
  let refresh_in_flight: Promise<void> | null = null

  return async function panelAiOwnerRoutes(fastify: FastifyInstance) {
    const db = overrides.db ?? prisma
    const isOwner = overrides.isOwner ?? is_owner
    const mistralPanelAgentIsConfigured = overrides.mistralPanelAgentIsConfigured ?? mistral_panel_agent_is_configured
    const customProviderIsConfigured = overrides.customProviderIsConfigured ?? custom_provider_is_configured
    const listCustomProviderModelsFn = overrides.listCustomProviderModels ?? list_custom_provider_models
    const testCustomProviderModelFn = overrides.testCustomProviderModel ?? test_custom_provider_model
    const testPanelAiRuntimeFn = overrides.testPanelAiRuntime ?? test_panel_ai_runtime

    fastify.get('/owner/panel-ai', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      if (!isOwner(request.user.userId)) return reply.code(403).send({ error: 'Forbidden' })
      const settings = await db.botSettings.findUnique({ where: { id: 'global' } })
      const customConfigured = customProviderIsConfigured()
      const savedProvider = settings?.panelAiProvider === 'custom' ? 'custom' : 'mistral'
      const rawFallback = settings?.panelAiFallbackEnabled ?? false
      const normalizedFallback = savedProvider === 'custom' ? false : rawFallback

      return reply.send({
        success: true,
        settings: {
          panelProvider: savedProvider,
          customModel: settings?.customProviderModel ?? null,
          customReasoningMode: normalize_custom_provider_reasoning_mode(settings?.customProviderReasoningMode),
          fallbackEnabled: normalizedFallback,
          sensitiveContextEnabled: settings?.panelAiSensitiveContextEnabled ?? false,
          conversationVersion: settings?.panelAiConversationVersion ?? 1,
        },
        runtimes: {
          mistralPanelAgentConfigured: mistralPanelAgentIsConfigured(),
          customProviderConfigured: customConfigured,
        },
        catalog: {
          models: catalog(settings?.customProviderModelCatalog),
          syncedAt: settings?.customProviderModelCatalogSyncedAt
            ? new Date(settings.customProviderModelCatalogSyncedAt).toISOString()
            : null,
          error: settings?.customProviderModelCatalogError ?? null,
          refreshing: refresh_in_flight !== null,
        },
      })
    })

    fastify.put('/owner/panel-ai', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      if (!isOwner(request.user.userId)) return reply.code(403).send({ error: 'Forbidden' })
      const input = parse_settings(request.body)
      if (!input) return reply.code(400).send({ error: 'Invalid body' })
      if ((input.provider === 'custom' || input.fallbackEnabled) && !customProviderIsConfigured()) {
        return reply.code(409).send({ error: 'Custom Provider is not configured' })
      }
      const saved = await db.botSettings.upsert({
        where: { id: 'global' },
        update: {
          panelAiProvider: input.provider,
          customProviderModel: input.customModel,
          customProviderReasoningMode: input.customReasoningMode,
          panelAiFallbackEnabled: input.fallbackEnabled,
          panelAiSensitiveContextEnabled: input.sensitiveContextEnabled,
          panelAiConversationVersion: { increment: 1 },
        },
        create: {
          id: 'global',
          panelAiProvider: input.provider,
          customProviderModel: input.customModel,
          customProviderReasoningMode: input.customReasoningMode,
          panelAiFallbackEnabled: input.fallbackEnabled,
          panelAiSensitiveContextEnabled: input.sensitiveContextEnabled,
        },
        select: {
          panelAiProvider: true,
          customProviderModel: true,
          customProviderReasoningMode: true,
          panelAiFallbackEnabled: true,
          panelAiSensitiveContextEnabled: true,
          panelAiConversationVersion: true,
        },
      })
      await db.ownerActionLog.create({
        data: {
          actorUserId: request.user.userId,
          type: 'update_panel_ai_runtime',
          status: 'executed',
          request: input,
          result: saved,
          executedAt: new Date(),
        },
      })
      return reply.send({
        success: true,
        settings: {
          panelProvider: saved.panelAiProvider === 'custom' ? 'custom' : 'mistral',
          customModel: saved.customProviderModel ?? null,
          customReasoningMode: normalize_custom_provider_reasoning_mode(saved.customProviderReasoningMode),
          fallbackEnabled: saved.panelAiProvider === 'custom' ? false : saved.panelAiFallbackEnabled,
          sensitiveContextEnabled: saved.panelAiSensitiveContextEnabled,
          conversationVersion: saved.panelAiConversationVersion,
        },
      })
    })

    fastify.post('/owner/panel-ai/catalog/refresh', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      if (!isOwner(request.user.userId)) return reply.code(403).send({ error: 'Forbidden' })
      if (!customProviderIsConfigured()) return reply.code(409).send({ error: 'Custom Provider is not configured' })
      if (!refresh_in_flight) {
        refresh_in_flight = listCustomProviderModelsFn()
          .then(async (models) => {
            await db.botSettings.upsert({
              where: { id: 'global' },
              update: {
                customProviderModelCatalog: models,
                customProviderModelCatalogSyncedAt: new Date(),
                customProviderModelCatalogError: null,
              },
              create: { id: 'global', customProviderModelCatalog: models, customProviderModelCatalogSyncedAt: new Date() },
            })
          })
          .catch(async (error: unknown) => {
            request.log.warn({ err: safe_error_details(error) }, 'Panel AI model catalog refresh failed')
            await db.botSettings.upsert({
              where: { id: 'global' },
              update: { customProviderModelCatalogError: error instanceof Error ? error.message : 'Model catalog refresh failed' },
              create: { id: 'global', customProviderModelCatalogError: 'Model catalog refresh failed' },
            })
          })
          .finally(() => {
            refresh_in_flight = null
          })
      }
      await db.ownerActionLog.create({
        data: {
          actorUserId: request.user.userId,
          type: 'refresh_custom_provider_model_catalog',
          status: 'executed',
          request: {},
          result: { started: true },
          executedAt: new Date(),
        },
      })
      return reply.code(202).send({ success: true, refreshing: true })
    })

    fastify.post('/owner/panel-ai/test', { preHandler: [fastify.authenticate] }, async (request, reply) => {
      if (!isOwner(request.user.userId)) return reply.code(403).send({ error: 'Forbidden' })
      const testInput = parse_test_request(request.body)
      if (!testInput) return reply.code(400).send({ error: 'Invalid body' })

      if (testInput.target === 'custom') {
        if (!customProviderIsConfigured()) return reply.code(409).send({ error: 'Custom Provider is not configured' })
        try {
          const result = await testCustomProviderModelFn(testInput.customModel, testInput.customReasoningMode)
          await db.ownerActionLog.create({
            data: {
              actorUserId: request.user.userId,
              type: 'test_custom_provider_model',
              status: 'executed',
              request: { target: 'custom', model: testInput.customModel, reasoningMode: testInput.customReasoningMode },
              result,
              executedAt: new Date(),
            },
          })
          return reply.send({
            success: true,
            result: {
              target: 'custom',
              model: result.model,
              reasoningMode: result.reasoningMode,
              latencyMs: result.latencyMs,
            },
          })
        } catch (error: unknown) {
          request.log.warn({ err: safe_error_details(error) }, 'Panel AI Custom Provider test failed')
          return reply.code(502).send({ error: 'Custom Provider test failed' })
        }
      }

      const settings = await db.botSettings.findUnique({ where: { id: 'global' } })
      const runtime = normalize_panel_ai_runtime({
        provider: settings?.panelAiProvider,
        customModel: settings?.customProviderModel,
        customReasoningMode: settings?.customProviderReasoningMode,
        fallbackEnabled: false,
      })

      if (runtime.provider === 'mistral' && !mistralPanelAgentIsConfigured()) {
        return reply.code(409).send({ error: 'Mistral Panel Agent is not configured' })
      }
      if (runtime.provider === 'custom' && !customProviderIsConfigured()) {
        return reply.code(409).send({ error: 'Custom Provider is not configured' })
      }

      try {
        const result = await testPanelAiRuntimeFn(runtime)
        await db.ownerActionLog.create({
          data: {
            actorUserId: request.user.userId,
            type: 'test_panel_ai_runtime',
            status: 'executed',
            request: {
              target: 'primary',
              provider: runtime.provider,
              model: runtime.customModel,
              reasoningMode: runtime.customReasoningMode,
            },
            result,
            executedAt: new Date(),
          },
        })
        return reply.send({
          success: true,
          result: {
            target: 'primary',
            provider: runtime.provider,
            model: runtime.customModel ?? undefined,
            latencyMs: result.latencyMs,
          },
        })
      } catch (error: unknown) {
        request.log.warn({ err: safe_error_details(error) }, 'Panel AI runtime test failed')
        return reply.code(502).send({ error: 'Runtime test failed' })
      }
    })
  }
}

export const panelAiOwnerRoutes = createPanelAiOwnerRoutes()
