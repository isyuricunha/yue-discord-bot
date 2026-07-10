import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'

import { custom_provider_is_configured, list_custom_provider_models } from '../services/custom_provider'
import { test_panel_ai_runtime } from '../services/panel_ai'
import { is_owner } from '../utils/permissions'
import { safe_error_details } from '../utils/safe_error'

let refresh_in_flight: Promise<void> | null = null

function parse_settings(body: unknown) {
  if (!body || typeof body !== 'object') return null
  const input = body as Record<string, unknown>
  const provider = input.panelProvider === 'mistral' || input.panelProvider === 'custom' ? input.panelProvider : null
  const customModel = typeof input.customModel === 'string' ? input.customModel.trim() : ''
  const sensitiveContextEnabled = typeof input.sensitiveContextEnabled === 'boolean' ? input.sensitiveContextEnabled : null
  if (!provider || sensitiveContextEnabled === null || (provider === 'custom' && !customModel)) return null
  return { provider, customModel: customModel || null, sensitiveContextEnabled }
}

function catalog(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}

export async function panelAiOwnerRoutes(fastify: FastifyInstance) {
  fastify.get('/owner/panel-ai', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (!is_owner(request.user.userId)) return reply.code(403).send({ error: 'Forbidden' })
    const settings = await prisma.botSettings.findUnique({ where: { id: 'global' } })
    const customProviderConfigured = custom_provider_is_configured()
    return reply.send({ success: true, settings: {
      panelProvider: settings?.panelAiProvider === 'custom' ? 'custom' : 'mistral',
      customModel: settings?.customProviderModel ?? null,
      sensitiveContextEnabled: settings?.panelAiSensitiveContextEnabled ?? false,
      conversationVersion: settings?.panelAiConversationVersion ?? 1,
    }, runtimes: { mistralPanelAgentConfigured: Boolean(process.env.MISTRAL_PANEL_AGENT_ID?.trim()), customProviderConfigured }, catalog: {
      models: catalog(settings?.customProviderModelCatalog), syncedAt: settings?.customProviderModelCatalogSyncedAt?.toISOString() ?? null,
      error: settings?.customProviderModelCatalogError ?? null, refreshing: refresh_in_flight !== null,
    } })
  })

  fastify.put('/owner/panel-ai', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (!is_owner(request.user.userId)) return reply.code(403).send({ error: 'Forbidden' })
    const input = parse_settings(request.body)
    if (!input) return reply.code(400).send({ error: 'Invalid body' })
    if (input.provider === 'custom' && !custom_provider_is_configured()) return reply.code(409).send({ error: 'Custom Provider is not configured' })
    const saved = await prisma.botSettings.upsert({ where: { id: 'global' }, update: {
      panelAiProvider: input.provider, customProviderModel: input.customModel, panelAiSensitiveContextEnabled: input.sensitiveContextEnabled,
      panelAiConversationVersion: { increment: 1 },
    }, create: { id: 'global', panelAiProvider: input.provider, customProviderModel: input.customModel, panelAiSensitiveContextEnabled: input.sensitiveContextEnabled }, select: {
      panelAiProvider: true, customProviderModel: true, panelAiSensitiveContextEnabled: true, panelAiConversationVersion: true,
    } })
    await prisma.ownerActionLog.create({ data: {
      actorUserId: request.user.userId,
      type: 'update_panel_ai_runtime',
      status: 'executed',
      request: input,
      result: saved,
      executedAt: new Date(),
    } })
    return reply.send({ success: true, settings: saved })
  })

  fastify.post('/owner/panel-ai/catalog/refresh', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (!is_owner(request.user.userId)) return reply.code(403).send({ error: 'Forbidden' })
    if (!custom_provider_is_configured()) return reply.code(409).send({ error: 'Custom Provider is not configured' })
    if (!refresh_in_flight) refresh_in_flight = list_custom_provider_models().then(async (models) => {
      await prisma.botSettings.upsert({ where: { id: 'global' }, update: { customProviderModelCatalog: models, customProviderModelCatalogSyncedAt: new Date(), customProviderModelCatalogError: null }, create: { id: 'global', customProviderModelCatalog: models, customProviderModelCatalogSyncedAt: new Date() } })
    }).catch(async (error: unknown) => {
      request.log.warn({ err: safe_error_details(error) }, 'Panel AI model catalog refresh failed')
      await prisma.botSettings.upsert({ where: { id: 'global' }, update: { customProviderModelCatalogError: error instanceof Error ? error.message : 'Model catalog refresh failed' }, create: { id: 'global', customProviderModelCatalogError: 'Model catalog refresh failed' } })
    }).finally(() => { refresh_in_flight = null })
    await prisma.ownerActionLog.create({ data: {
      actorUserId: request.user.userId,
      type: 'refresh_custom_provider_model_catalog',
      status: 'executed',
      request: {},
      result: { started: true },
      executedAt: new Date(),
    } })
    return reply.code(202).send({ success: true, refreshing: true })
  })

  fastify.post('/owner/panel-ai/test', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (!is_owner(request.user.userId)) return reply.code(403).send({ error: 'Forbidden' })
    const settings = await prisma.botSettings.findUnique({ where: { id: 'global' } })
    const runtime = { provider: settings?.panelAiProvider === 'custom' ? 'custom' as const : 'mistral' as const, customModel: settings?.customProviderModel ?? null }
    try {
      const result = await test_panel_ai_runtime(runtime)
      await prisma.ownerActionLog.create({ data: {
        actorUserId: request.user.userId,
        type: 'test_custom_provider_model',
        status: 'executed',
        request: { provider: runtime.provider, model: runtime.customModel },
        result,
        executedAt: new Date(),
      } })
      return reply.send({ success: true, result })
    } catch (error: unknown) {
      request.log.warn({ err: safe_error_details(error) }, 'Panel AI Custom Provider test failed')
      return reply.code(502).send({ error: 'Custom Provider test failed' })
    }
  })
}
