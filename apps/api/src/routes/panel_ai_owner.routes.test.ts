import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify, { type FastifyBaseLogger } from 'fastify'
import { MistralError } from '@mistralai/mistralai/models/errors'

import { createPanelAiOwnerRoutes, type panel_ai_owner_deps } from './panel_ai_owner.routes'

type test_user = {
  userId: string
  isOwner: boolean
}

function create_test_owner_app(
  overrides: Partial<panel_ai_owner_deps> = {},
  user: test_user | null = { userId: 'owner-1', isOwner: true },
) {
  const defaultDbState: any = {
    id: 'global',
    panelAiProvider: 'mistral',
    customProviderModel: 'opaque/default-model',
    customProviderReasoningMode: 'omit',
    panelAiFallbackEnabled: false,
    panelAiSensitiveContextEnabled: false,
    panelAiConversationVersion: 1,
    customProviderModelCatalog: [],
    customProviderModelCatalogSyncedAt: null,
    customProviderModelCatalogError: null,
  }

  let dbState = { ...defaultDbState }
  const actionLogs: any[] = []

  const mockDb = {
    botSettings: {
      findUnique: async () => structuredClone(dbState),
      upsert: async (args: any) => {
        let newVersion = dbState.panelAiConversationVersion ?? 1
        if (args.update?.panelAiConversationVersion?.increment) {
          newVersion += args.update.panelAiConversationVersion.increment
        }
        const { panelAiConversationVersion, ...updateWithoutVersion } = args.update || {}
        dbState = {
          ...dbState,
          ...(args.create || {}),
          ...updateWithoutVersion,
          panelAiConversationVersion: newVersion,
        }
        return structuredClone(dbState)
      },
    },
    ownerActionLog: {
      create: async (args: any) => {
        actionLogs.push(args.data)
        return args.data
      },
    },
  }

  const deps: Partial<panel_ai_owner_deps> = {
    db: mockDb,
    isOwner: (_userId) => user?.isOwner ?? false,
    mistralPanelAgentIsConfigured: () => true,
    customProviderIsConfigured: () => true,
    listCustomProviderModels: async () => [{ id: 'opaque/test-model', group: 'opaque', label: 'test-model' }],
    testCustomProviderModel: async (model, mode) => ({ model, reasoningMode: mode, latencyMs: 12 }),
    testPanelAiRuntime: async (runtime) => ({ model: runtime.customModel ?? 'agent', latencyMs: 15 }),
    ...overrides,
  }

  const app = Fastify()
  app.decorate('authenticate', async (request: any, reply: any) => {
    if (!user) {
      await reply.code(401).send({ error: 'Unauthorized' })
      return
    }
    request.user = user
  }) as any

  app.register(createPanelAiOwnerRoutes(deps))
  return { app, actionLogs, getDbState: () => dbState, setDbState: (s: any) => { dbState = s } }
}

test('GET /owner/panel-ai requires authentication and owner permissions', async (t) => {
  const { app: unauthApp } = create_test_owner_app({}, null)
  t.after(async () => unauthApp.close())

  const resUnauth = await unauthApp.inject({ method: 'GET', url: '/owner/panel-ai' })
  assert.equal(resUnauth.statusCode, 401)

  const { app: nonOwnerApp } = create_test_owner_app({}, { userId: 'user-1', isOwner: false })
  t.after(async () => nonOwnerApp.close())

  const resForbidden = await nonOwnerApp.inject({ method: 'GET', url: '/owner/panel-ai' })
  assert.equal(resForbidden.statusCode, 403)
  assert.deepEqual(resForbidden.json(), { error: 'Forbidden' })
})

test('GET /owner/panel-ai handles missing BotSettings row defaults', async (t) => {
  const { app, setDbState } = create_test_owner_app({
    mistralPanelAgentIsConfigured: () => false,
    customProviderIsConfigured: () => false,
  })
  t.after(async () => app.close())

  setDbState(null) // Simulate missing DB row

  const res = await app.inject({ method: 'GET', url: '/owner/panel-ai' })
  assert.equal(res.statusCode, 200)
  const body = res.json()

  assert.equal(body.success, true)
  assert.equal(body.settings.panelProvider, 'mistral')
  assert.equal(body.settings.customModel, null)
  assert.equal(body.settings.customReasoningMode, 'omit')
  assert.equal(body.settings.fallbackEnabled, false)
  assert.equal(body.settings.sensitiveContextEnabled, false)
  assert.equal(body.settings.conversationVersion, 1)
  assert.equal(body.runtimes.mistralPanelAgentConfigured, false)
  assert.equal(body.runtimes.customProviderConfigured, false)
})

test('GET /owner/panel-ai normalizes custom primary fallback to false, invalid mode to omit, and masks secrets', async (t) => {
  const { app, setDbState } = create_test_owner_app({
    mistralPanelAgentIsConfigured: () => true,
  })
  t.after(async () => app.close())

  setDbState({
    id: 'global',
    panelAiProvider: 'custom',
    customProviderModel: 'opaque/model',
    customProviderReasoningMode: 'INVALID_MODE',
    panelAiFallbackEnabled: true, // Stale true
    panelAiSensitiveContextEnabled: true,
    panelAiConversationVersion: 3,
  })

  const res = await app.inject({ method: 'GET', url: '/owner/panel-ai' })
  assert.equal(res.statusCode, 200)
  const body = res.json()

  assert.equal(body.success, true)
  assert.equal(body.settings.panelProvider, 'custom')
  assert.equal(body.settings.customReasoningMode, 'omit')
  assert.equal(body.settings.fallbackEnabled, false)
  assert.equal(body.settings.conversationVersion, 3)
  assert.equal(body.runtimes.mistralPanelAgentConfigured, true)

  const serialized = JSON.stringify(body)
  assert.equal(serialized.includes('MISTRAL_API_KEY'), false)
  assert.equal(serialized.includes('CUSTOM_PROVIDER_API_KEY'), false)
  assert.equal(serialized.includes('http://'), false)
})

test('PUT /owner/panel-ai validates all 6 reasoning modes with exact 200 responses and numeric version increments', async (t) => {
  const { app, actionLogs, getDbState } = create_test_owner_app()
  t.after(async () => app.close())

  const validModes = ['omit', 'none', 'minimal', 'low', 'medium', 'high'] as const
  let expectedVersion = 1

  for (const validMode of validModes) {
    actionLogs.length = 0
    expectedVersion += 1

    const res = await app.inject({
      method: 'PUT',
      url: '/owner/panel-ai',
      payload: {
        panelProvider: 'mistral',
        customModel: 'opaque/test-model',
        customReasoningMode: validMode,
        fallbackEnabled: false,
        sensitiveContextEnabled: false,
      },
    })

    assert.equal(res.statusCode, 200, `Expected 200 for valid mode ${validMode}`)
    const body = res.json()
    assert.equal(body.success, true)
    assert.equal(body.settings.customReasoningMode, validMode)
    assert.equal(body.settings.conversationVersion, expectedVersion)

    assert.equal(typeof getDbState().panelAiConversationVersion, 'number')
    assert.equal(getDbState().panelAiConversationVersion, expectedVersion)

    assert.equal(actionLogs.length, 1)
    assert.equal(actionLogs[0]?.type, 'update_panel_ai_runtime')
    assert.equal(actionLogs[0]?.request.customReasoningMode, validMode)
    assert.equal(actionLogs[0]?.result.panelAiConversationVersion, expectedVersion)
  }

  for (const invalidMode of [true, false, null, 123, ['high'], { mode: 'high' }, 'ultra_high']) {
    const res = await app.inject({
      method: 'PUT',
      url: '/owner/panel-ai',
      payload: {
        panelProvider: 'mistral',
        customModel: 'opaque/test-model',
        customReasoningMode: invalidMode,
        fallbackEnabled: false,
        sensitiveContextEnabled: false,
      },
    })

    assert.equal(res.statusCode, 400, `Expected 400 for invalid mode ${JSON.stringify(invalidMode)}`)
  }
})

test('PUT /owner/panel-ai enforces model presence and 409 when Custom Provider is unconfigured', async (t) => {
  const { app: appUnconfigured } = create_test_owner_app({ customProviderIsConfigured: () => false })
  t.after(async () => appUnconfigured.close())

  // Unconfigured 409
  const resCustom409 = await appUnconfigured.inject({
    method: 'PUT',
    url: '/owner/panel-ai',
    payload: {
      panelProvider: 'custom',
      customModel: 'opaque/model',
      customReasoningMode: 'omit',
      fallbackEnabled: false,
      sensitiveContextEnabled: false,
    },
  })
  assert.equal(resCustom409.statusCode, 409)

  const resFallback409 = await appUnconfigured.inject({
    method: 'PUT',
    url: '/owner/panel-ai',
    payload: {
      panelProvider: 'mistral',
      customModel: 'opaque/model',
      customReasoningMode: 'omit',
      fallbackEnabled: true,
      sensitiveContextEnabled: false,
    },
  })
  assert.equal(resFallback409.statusCode, 409)

  // Configured but missing model 400
  const { app: appConfigured } = create_test_owner_app({ customProviderIsConfigured: () => true })
  t.after(async () => appConfigured.close())

  const resCustomNoModel = await appConfigured.inject({
    method: 'PUT',
    url: '/owner/panel-ai',
    payload: {
      panelProvider: 'custom',
      customModel: '',
      customReasoningMode: 'omit',
      fallbackEnabled: false,
      sensitiveContextEnabled: false,
    },
  })
  assert.equal(resCustomNoModel.statusCode, 400)

  const resFallbackNoModel = await appConfigured.inject({
    method: 'PUT',
    url: '/owner/panel-ai',
    payload: {
      panelProvider: 'mistral',
      customModel: '',
      customReasoningMode: 'omit',
      fallbackEnabled: true,
      sensitiveContextEnabled: false,
    },
  })
  assert.equal(resFallbackNoModel.statusCode, 400)
})

test('PUT /owner/panel-ai persists fallback false when custom is primary and preserves model/mode when fallback is disabled', async (t) => {
  const { app, getDbState } = create_test_owner_app()
  t.after(async () => app.close())

  // Custom primary persists fallback false
  const resCustom = await app.inject({
    method: 'PUT',
    url: '/owner/panel-ai',
    payload: {
      panelProvider: 'custom',
      customModel: 'opaque/model-a',
      customReasoningMode: 'high',
      fallbackEnabled: true, // Ignored and normalized to false
      sensitiveContextEnabled: true,
    },
  })
  assert.equal(resCustom.statusCode, 200)
  assert.equal(resCustom.json().settings.fallbackEnabled, false)
  assert.equal(getDbState().panelAiFallbackEnabled, false)

  // Mistral with fallback disabled preserves selected model and mode
  const resMistral = await app.inject({
    method: 'PUT',
    url: '/owner/panel-ai',
    payload: {
      panelProvider: 'mistral',
      customModel: 'opaque/model-b',
      customReasoningMode: 'medium',
      fallbackEnabled: false,
      sensitiveContextEnabled: false,
    },
  })
  assert.equal(resMistral.statusCode, 200)
  assert.equal(resMistral.json().settings.customModel, 'opaque/model-b')
  assert.equal(resMistral.json().settings.customReasoningMode, 'medium')
  assert.equal(getDbState().customProviderModel, 'opaque/model-b')
  assert.equal(getDbState().customProviderReasoningMode, 'medium')
})

test('POST /owner/panel-ai/test rejects malformed test request bodies with 400', async (t) => {
  const { app } = create_test_owner_app()
  t.after(async () => app.close())

  const malformedObjects = [
    { target: 'invalid' },
    ['custom'],
    { customModel: 'opaque/model' },
    { target: 'fallback' },
    { target: 'mistral' },
    { target: [123] },
    { target: 123 },
    { target: true },
  ]

  for (const malformedBody of malformedObjects) {
    const res = await app.inject({
      method: 'POST',
      url: '/owner/panel-ai/test',
      payload: malformedBody,
    })
    assert.equal(res.statusCode, 400, `Should reject object: ${JSON.stringify(malformedBody)}`)
  }

  const malformedPrimitives = ['"custom"', '123', 'true', 'false', 'null']
  for (const rawPayload of malformedPrimitives) {
    const res = await app.inject({
      method: 'POST',
      url: '/owner/panel-ai/test',
      headers: { 'content-type': 'application/json' },
      payload: rawPayload,
    })
    assert.equal(res.statusCode, 400, `Should reject JSON primitive: ${rawPayload}`)
  }
})

test('POST /owner/panel-ai/test primary target tests saved primary only without fallback or settings mutations', async (t) => {
  let primaryTestCalls = 0
  let testedRuntime: any = null

  const { app, getDbState } = create_test_owner_app({
    testPanelAiRuntime: async (runtime) => {
      primaryTestCalls += 1
      testedRuntime = runtime
      return { model: 'agent', latencyMs: 30 }
    },
  })
  t.after(async () => app.close())

  const initialDb = structuredClone(getDbState())

  const res = await app.inject({
    method: 'POST',
    url: '/owner/panel-ai/test',
    payload: { target: 'primary' },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(primaryTestCalls, 1)
  assert.equal(testedRuntime.provider, 'mistral')
  assert.equal(testedRuntime.fallbackEnabled, false, 'Primary test must force fallback disabled')
  assert.deepEqual(getDbState(), initialDb, 'Primary test must not mutate database settings')

  // Unconfigured primary returns HTTP 409 without calling test runner or mutating settings
  const { app: appUnconfigured } = create_test_owner_app({
    mistralPanelAgentIsConfigured: () => false,
  })
  t.after(async () => appUnconfigured.close())

  const resUnconfigured = await appUnconfigured.inject({
    method: 'POST',
    url: '/owner/panel-ai/test',
    payload: { target: 'primary' },
  })
  assert.equal(resUnconfigured.statusCode, 409)

  // Configured primary failing upstream returns HTTP 502
  const { app: appUpstreamFail } = create_test_owner_app({
    mistralPanelAgentIsConfigured: () => true,
    testPanelAiRuntime: async () => {
      throw new Error('Upstream API failure')
    },
  })
  t.after(async () => appUpstreamFail.close())

  const resUpstreamFail = await appUpstreamFail.inject({
    method: 'POST',
    url: '/owner/panel-ai/test',
    payload: { target: 'primary' },
  })
  assert.equal(resUpstreamFail.statusCode, 502)
})

test('POST /owner/panel-ai/test custom target tests unsaved model and mode without settings mutation', async (t) => {
  let testedModel = ''
  let testedMode = ''

  const { app, getDbState } = create_test_owner_app({
    testCustomProviderModel: async (model, mode) => {
      testedModel = model
      testedMode = mode
      return { model, reasoningMode: mode, latencyMs: 25 }
    },
  })
  t.after(async () => app.close())

  const initialDb = structuredClone(getDbState())

  const res = await app.inject({
    method: 'POST',
    url: '/owner/panel-ai/test',
    payload: {
      target: 'custom',
      customModel: 'opaque/unsaved-model',
      customReasoningMode: 'high',
    },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(testedModel, 'opaque/unsaved-model')
  assert.equal(testedMode, 'high')
  assert.deepEqual(getDbState(), initialDb, 'Custom test must not mutate database settings')
  const body = res.json()
  assert.equal(body.result.target, 'custom')
  assert.equal(body.result.model, 'opaque/unsaved-model')
  assert.equal(body.result.reasoningMode, 'high')
})

test('POST /owner/panel-ai/test primary target tests sanitize secrets from warning logs and response', async (t) => {
  const SECRET_STRING = 'SECRET_MISTRAL_RAW_MESSAGE_91e4'
  const capturedLogEntries: any[] = []
  
  const { app, getDbState } = create_test_owner_app({
    mistralPanelAgentIsConfigured: () => true,
    testPanelAiRuntime: async (runtime) => {
      const { test_panel_ai_runtime } = await import('../services/panel_ai')
      return test_panel_ai_runtime(runtime, {
        startMistralConversation: async () => {
          const fakeResponse = new Response('{}', { status: 400 })
          const fakeRequest = new Request('https://api.mistral.ai/v1/conversations')
          throw new MistralError(SECRET_STRING, { response: fakeResponse, request: fakeRequest, body: '{}' })
        },
      })
    },
  })
  
  app.addHook('preHandler', async (request) => {
    const requestWithMutableLog = request as unknown as { log: FastifyBaseLogger }
    requestWithMutableLog.log = {
      ...requestWithMutableLog.log,
      warn: (object: unknown, message: unknown) => {
        capturedLogEntries.push({ object, message })
      },
    } as unknown as FastifyBaseLogger
  })
  
  t.after(async () => app.close())
  
  const initialDb = structuredClone(getDbState())
  
  const res = await app.inject({
    method: 'POST',
    url: '/owner/panel-ai/test',
    payload: { target: 'primary' },
  })
  
  assert.equal(res.statusCode, 502)
  assert.deepEqual(getDbState(), initialDb, 'Settings must remain unchanged')
  
  const allLogSerialized = JSON.stringify(capturedLogEntries)
  assert.equal(allLogSerialized.includes(SECRET_STRING), false, 'Secret must not appear in owner route warning logs')
  assert.equal(JSON.stringify(res.json()).includes(SECRET_STRING), false, 'Secret must not appear in HTTP response')
})
