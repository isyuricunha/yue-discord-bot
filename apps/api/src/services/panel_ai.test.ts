import assert from 'node:assert/strict'
import test from 'node:test'

import { MistralError } from '@mistralai/mistralai/models/errors'

import { PANEL_CONTRACT_RULES } from './panel_context'
import {
  build_custom_provider_messages,
  build_custom_provider_payload,
  build_mistral_agent_request,
  classify_mistral_failure,
  complete_panel_ai,
  extract_mistral_text,
  MistralEmptyResponseError,
  MistralNotConfiguredError,
  MistralTimeoutError,
  test_panel_ai_runtime,
  type mistral_agent_request,
  type panel_ai_message,
  type panel_ai_runtime_event,
} from './panel_ai'

const natural_messages: panel_ai_message[] = [
  { role: 'user', content: 'Earlier question' },
  { role: 'assistant', content: 'Earlier answer' },
  { role: 'user', content: 'Current question' },
]

test('builds a valid Mistral Agent conversation request with runtime context first', () => {
  const original_messages = structuredClone(natural_messages)
  const request = build_mistral_agent_request('agent-123', 'Guild: Yue Lab\nAnti-raid: enabled', natural_messages)

  assert.deepEqual(Object.keys(request).sort(), ['agentId', 'inputs', 'store'])
  assert.equal(request.agentId, 'agent-123')
  assert.equal(request.store, false)
  assert.equal(
    Object.hasOwn(request, 'instructions'),
    false,
    'Agent conversations must not send per-request instructions',
  )
  assert.equal(Object.hasOwn(request, 'model'), false)
  assert.equal(Object.hasOwn(request, 'tools'), false)

  assert.equal(request.inputs[0]?.role, 'user')
  assert.match(request.inputs[0]?.content ?? '', /^\[APPLICATION_RUNTIME_CONTEXT\]/)
  assert.match(request.inputs[0]?.content ?? '', /Guild: Yue Lab/)
  assert.match(request.inputs[0]?.content ?? '', /Anti-raid: enabled/)
  assert.ok(request.inputs[0]?.content.includes(PANEL_CONTRACT_RULES))
  assert.match(request.inputs[0]?.content ?? '', /\[\/APPLICATION_RUNTIME_CONTEXT\]$/)
  assert.deepEqual(
    request.inputs.slice(1).map(({ role, content }) => ({ role, content })),
    natural_messages,
  )
  assert.equal(request.inputs.at(-1)?.content, 'Current question')
  assert.deepEqual(natural_messages, original_messages)
})

test('complete_panel_ai sends the narrow Agent payload without the Custom Provider persona', async () => {
  let captured_request: mistral_agent_request | undefined
  const response = await complete_panel_ai({
    runtime: { provider: 'mistral', customModel: null, customReasoningMode: 'omit', fallbackEnabled: false },
    persona: 'Private Custom Provider persona',
    context: 'Guild ID: guild-1',
    messages: natural_messages,
  }, {
    mistralAgentId: 'agent-123',
    startMistralConversation: async (request) => {
      captured_request = request
      return { outputs: [{ type: 'message.output', content: 'Agent response' }] }
    },
  })

  assert.equal(response, 'Agent response')
  assert.ok(captured_request)
  assert.deepEqual(Object.keys(captured_request).sort(), ['agentId', 'inputs', 'store'])
  assert.equal(captured_request.inputs.some(({ content }) => content.includes('Private Custom Provider persona')), false)
})

test('test_panel_ai_runtime uses the valid Mistral Agent payload', async () => {
  let captured_request: mistral_agent_request | undefined
  const result = await test_panel_ai_runtime(
    { provider: 'mistral', customModel: null, customReasoningMode: 'omit', fallbackEnabled: false },
    {
      mistralAgentId: 'agent-runtime-test',
      startMistralConversation: async (request) => {
        captured_request = request
        return { outputs: [{ type: 'message.output', content: 'OK' }] }
      },
    },
  )

  assert.equal(result.model, 'agent')
  assert.ok(captured_request)
  assert.equal(captured_request.agentId, 'agent-runtime-test')
  assert.equal(Object.hasOwn(captured_request, 'instructions'), false)
  assert.match(captured_request.inputs[0]?.content ?? '', /^\[APPLICATION_RUNTIME_CONTEXT\]/)
  assert.equal(captured_request.inputs.at(-1)?.content, 'Reply with exactly: OK')
})

test('preserves Custom Provider persona, context contract, and natural message order', () => {
  const custom_messages = build_custom_provider_messages(
    'Custom Ella persona',
    'Guild: Yue Lab',
    natural_messages,
  )

  assert.deepEqual(custom_messages.slice(0, 2).map(({ role }) => role), ['system', 'system'])
  assert.equal(custom_messages[0]?.content, 'Custom Ella persona')
  assert.match(custom_messages[1]?.content ?? '', /^Guild: Yue Lab/)
  assert.ok(custom_messages[1]?.content.includes(PANEL_CONTRACT_RULES))
  assert.deepEqual(custom_messages.slice(2), natural_messages)
})

test('extracts text from a string content', () => {
  const outputs = [
    { object: 'entry', type: 'message.output', role: 'assistant', content: 'Hello from Ella' },
  ]
  assert.equal(extract_mistral_text(outputs), 'Hello from Ella')
})

test('extracts text from an array of typed chunks', () => {
  const outputs = [
    {
      object: 'entry',
      type: 'message.output',
      role: 'assistant',
      content: [
        { type: 'text', text: 'First paragraph' },
        { type: 'text', text: 'Second paragraph' },
      ],
    },
  ]
  assert.equal(extract_mistral_text(outputs), 'First paragraph\nSecond paragraph')
})

test('extracts text from an array containing plain strings', () => {
  const outputs = [
    {
      object: 'entry',
      type: 'message.output',
      role: 'assistant',
      content: ['Chunk A', 'Chunk B'],
    },
  ]
  assert.equal(extract_mistral_text(outputs), 'Chunk A\nChunk B')
})

test('uses the last message.output when multiple outputs are present', () => {
  const outputs = [
    { object: 'entry', type: 'message.output', role: 'assistant', content: 'Old reply' },
    { object: 'entry', type: 'function_call', name: 'some_tool' },
    { object: 'entry', type: 'message.output', role: 'assistant', content: 'Latest reply' },
  ]
  assert.equal(extract_mistral_text(outputs), 'Latest reply')
})

test('returns empty string for invalid or empty responses', () => {
  assert.equal(extract_mistral_text(undefined), '')
  assert.equal(extract_mistral_text(null), '')
  assert.equal(extract_mistral_text('not an array'), '')
  assert.equal(extract_mistral_text([]), '')
  assert.equal(extract_mistral_text([{ type: 'function_call', name: 'tool' }]), '')
  assert.equal(
    extract_mistral_text([{ type: 'message.output', content: [{ type: 'image_url', image_url: 'x' }] }]),
    '',
  )
  assert.equal(extract_mistral_text([{ type: 'message.output', content: '' }]), '')
  assert.equal(extract_mistral_text([{ type: 'message.output', content: [] }]), '')
})

test('ignores non-text chunks within a mixed content array', () => {
  const outputs = [
    {
      type: 'message.output',
      content: [
        { type: 'think', think: 'internal reasoning' },
        { type: 'text', text: 'visible answer' },
        { type: 'tool_reference', tool_call_id: 'abc' },
      ],
    },
  ]
  assert.equal(extract_mistral_text(outputs), 'visible answer')
})

test('accepts chunks with text when type is absent (SDK optional type)', () => {
  const outputs = [
    {
      type: 'message.output',
      content: [
        { text: 'visible answer' },
      ],
    },
  ]
  assert.equal(extract_mistral_text(outputs), 'visible answer')
})

test('build_custom_provider_payload produces payload with omit mode', () => {
  const payload = build_custom_provider_payload({
    model: 'custom/model-id',
    persona: 'Private Persona',
    context: 'Guild Context',
    messages: natural_messages,
    reasoningMode: 'omit',
  })

  assert.equal(payload.model, 'custom/model-id')
  assert.equal(payload.temperature, 0.4)
  assert.equal(Object.hasOwn(payload, 'reasoning_effort'), false)
  assert.equal(Object.hasOwn(payload, 'reasoning'), false)
  assert.equal(payload.messages[0]?.content, 'Private Persona')
})

test('build_custom_provider_payload produces payload with high mode', () => {
  const payload = build_custom_provider_payload({
    model: 'custom/model-id',
    persona: 'Private Persona',
    context: 'Guild Context',
    messages: natural_messages,
    reasoningMode: 'high',
  })

  assert.equal(payload.model, 'custom/model-id')
  assert.equal((payload as Record<string, unknown>).reasoning_effort, 'high')
  assert.equal(Object.hasOwn(payload, 'reasoning'), false)
})

function create_mistral_error(status: number): MistralError {
  const fakeResponse = new Response('{}', { status, headers: { 'content-type': 'application/json' } })
  const fakeRequest = new Request('https://api.mistral.ai/v1/conversations')
  return new MistralError('Mistral HTTP Error', { response: fakeResponse, request: fakeRequest, body: '{}' })
}

test('classify_mistral_failure correctly classifies typed errors and HTTP status codes', () => {
  assert.deepEqual(classify_mistral_failure(new MistralNotConfiguredError()), { eligible: true, category: 'not_configured' })
  assert.deepEqual(classify_mistral_failure(new MistralTimeoutError()), { eligible: true, category: 'timeout' })
  assert.deepEqual(classify_mistral_failure(new MistralEmptyResponseError()), { eligible: true, category: 'empty_response' })

  assert.equal(classify_mistral_failure(create_mistral_error(401)).category, 'authentication')
  assert.equal(classify_mistral_failure(create_mistral_error(403)).category, 'authorization')
  assert.equal(classify_mistral_failure(create_mistral_error(408)).category, 'timeout')
  assert.equal(classify_mistral_failure(create_mistral_error(429)).category, 'rate_limited')
  assert.equal(classify_mistral_failure(create_mistral_error(500)).category, 'server_error')
  assert.equal(classify_mistral_failure(create_mistral_error(503)).category, 'server_error')

  assert.equal(classify_mistral_failure(create_mistral_error(400)).eligible, false)
  assert.equal(classify_mistral_failure(create_mistral_error(404)).eligible, false)
  assert.equal(classify_mistral_failure(create_mistral_error(409)).eligible, false)
  assert.equal(classify_mistral_failure(create_mistral_error(422)).eligible, false)

  assert.equal(classify_mistral_failure({ code: 'ECONNRESET' }).category, 'transport')
  assert.equal(classify_mistral_failure({ code: 'ETIMEDOUT' }).category, 'transport')
  assert.equal(classify_mistral_failure({ code: 'ECONNREFUSED' }).category, 'transport')
  assert.equal(classify_mistral_failure({ code: 'ENOTFOUND' }).category, 'transport')
  assert.equal(classify_mistral_failure({ code: 'EAI_AGAIN' }).category, 'transport')

  assert.equal(classify_mistral_failure(new TypeError('Cannot read properties of undefined')).eligible, false)
  assert.equal(classify_mistral_failure(new TypeError('Cannot read properties of undefined')).category, 'programming_error')
})

test('classify_mistral_failure requires real MistralError instance for HTTP status classification', () => {
  const realMistralError = create_mistral_error(500)
  assert.equal(classify_mistral_failure(realMistralError).eligible, true)
  assert.equal(classify_mistral_failure(realMistralError).category, 'server_error')

  const plainObject = { statusCode: 500 }
  assert.equal(classify_mistral_failure(plainObject).eligible, false)
  assert.equal(classify_mistral_failure(plainObject).category, 'unknown')

  const localError = Object.assign(new Error('Internal error'), { statusCode: 500 })
  assert.equal(classify_mistral_failure(localError).eligible, false)
  assert.equal(classify_mistral_failure(localError).category, 'unknown')

  const fetchTypeError = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
  assert.equal(classify_mistral_failure(fetchTypeError).eligible, true)
  assert.equal(classify_mistral_failure(fetchTypeError).category, 'transport')

  const plainTypeError = new TypeError('Cannot read properties of null')
  assert.equal(classify_mistral_failure(plainTypeError).eligible, false)
  assert.equal(classify_mistral_failure(plainTypeError).category, 'programming_error')

  class FakeMistralError extends Error {
    statusCode = 500
    constructor() {
      super('Fake')
      this.name = 'MistralError'
    }
  }
  const spoofed = new FakeMistralError()
  assert.equal(classify_mistral_failure(spoofed).eligible, false, 'locally declared MistralError class must not be eligible')
  assert.equal(classify_mistral_failure(spoofed).category, 'unknown')
})

test('complete_panel_ai uses normalized runtime for custom fallback execution', async () => {
  let capturedModel = ''
  let capturedReasoningMode = ''

  await complete_panel_ai(
    {
      runtime: {
        provider: 'mistral',
        customModel: '  opaque/padded-model  ',
        customReasoningMode: ' INVALID_MODE ' as any,
        fallbackEnabled: true,
      },
      persona: 'Persona',
      context: 'Context',
      messages: natural_messages,
    },
    {
      mistralAgentId: 'agent-1',
      customProviderConfigured: true,
      startMistralConversation: async () => {
        throw create_mistral_error(429)
      },
      completeWithCustomProvider: async (input) => {
        capturedModel = input.model
        capturedReasoningMode = input.reasoningMode
        return 'Fallback OK'
      },
    },
  )

  assert.equal(capturedModel, 'opaque/padded-model')
  assert.equal(capturedReasoningMode, 'omit')
})

test('complete_panel_ai handles deterministic timeout race with late primary resolution without duplicate events', async () => {
  let primaryStartCount = 0
  let fallbackStartCount = 0
  const loggedEvents: panel_ai_runtime_event[] = []

  let resolvePrimary!: (val: any) => void
  const primaryPromise = new Promise((resolve) => {
    resolvePrimary = resolve
  })

  const timeoutSignal = Promise.reject(new MistralTimeoutError('Mistral Agent request timed out'))
  timeoutSignal.catch(() => {})

  const result = await complete_panel_ai(
    {
      runtime: { provider: 'mistral', customModel: 'opaque/model', customReasoningMode: 'high', fallbackEnabled: true },
      persona: 'Persona',
      context: 'Context',
      messages: natural_messages,
    },
    {
      mistralAgentId: 'agent-1',
      customProviderConfigured: true,
      timeoutSignal,
      startMistralConversation: async () => {
        primaryStartCount += 1
        return primaryPromise
      },
      completeWithCustomProvider: async () => {
        fallbackStartCount += 1
        return 'FALLBACK SUCCESS'
      },
      logEvent: (event) => loggedEvents.push(event),
    },
  )

  assert.equal(result, 'FALLBACK SUCCESS')
  assert.equal(primaryStartCount, 1, 'Primary request begins once')
  assert.equal(fallbackStartCount, 1, 'Fallback begins once')

  resolvePrimary({ outputs: [{ type: 'message.output', content: 'LATE PRIMARY' }] })
  await new Promise((r) => setImmediate(r))

  assert.equal(loggedEvents.length, 2, 'No duplicate runtime events occur')
  assert.equal(loggedEvents[0]?.type, 'fallback_attempted')
  assert.equal(loggedEvents[1]?.type, 'fallback_succeeded')
})

test('complete_panel_ai handles deterministic timeout race with late primary rejection without duplicate events', async (t) => {
  let primaryStartCount = 0
  let fallbackStartCount = 0
  const loggedEvents: panel_ai_runtime_event[] = []

  let unhandledRejections = 0
  const rejectionHandler = () => {
    unhandledRejections += 1
  }
  process.on('unhandledRejection', rejectionHandler)
  t.after(() => {
    process.removeListener('unhandledRejection', rejectionHandler)
  })

  let rejectPrimary!: (err: any) => void
  const primaryPromise = new Promise((_, reject) => {
    rejectPrimary = reject
  })

  const timeoutSignal = Promise.reject(new MistralTimeoutError('Mistral Agent request timed out'))
  timeoutSignal.catch(() => {})

  const result = await complete_panel_ai(
    {
      runtime: { provider: 'mistral', customModel: 'opaque/model', customReasoningMode: 'high', fallbackEnabled: true },
      persona: 'Persona',
      context: 'Context',
      messages: natural_messages,
    },
    {
      mistralAgentId: 'agent-1',
      customProviderConfigured: true,
      timeoutSignal,
      startMistralConversation: async () => {
        primaryStartCount += 1
        return primaryPromise
      },
      completeWithCustomProvider: async () => {
        fallbackStartCount += 1
        return 'FALLBACK SUCCESS'
      },
      logEvent: (event) => loggedEvents.push(event),
    },
  )

  assert.equal(result, 'FALLBACK SUCCESS')
  assert.equal(primaryStartCount, 1, 'Primary request begins once')
  assert.equal(fallbackStartCount, 1, 'Fallback begins once')

  rejectPrimary(new Error('LATE REJECTION'))
  await new Promise((r) => setImmediate(r))

  assert.equal(unhandledRejections, 0, 'Late rejection must be consumed by orchestration')
  assert.equal(loggedEvents.length, 2, 'No duplicate runtime events occur')
  assert.equal(loggedEvents[0]?.type, 'fallback_attempted')
  assert.equal(loggedEvents[1]?.type, 'fallback_succeeded')
})

test('complete_panel_ai passes page context section to Mistral and Custom Provider', async () => {
  let capturedMistralContext = ''
  let capturedCustomContext = ''

  await complete_panel_ai(
    {
      runtime: { provider: 'mistral', customModel: null, customReasoningMode: 'omit', fallbackEnabled: false },
      persona: 'Persona',
      context: 'Page context section details',
      messages: natural_messages,
    },
    {
      mistralAgentId: 'agent-1',
      startMistralConversation: async (req) => {
        capturedMistralContext = req.inputs[0]?.content ?? ''
        return { outputs: [{ type: 'message.output', content: 'Mistral OK' }] }
      },
    },
  )

  assert.ok(capturedMistralContext.includes('Page context section details'))

  await complete_panel_ai(
    {
      runtime: { provider: 'custom', customModel: 'opaque/model', customReasoningMode: 'high', fallbackEnabled: false },
      persona: 'Persona',
      context: 'Page context section details',
      messages: natural_messages,
    },
    {
      completeWithCustomProvider: async (input) => {
        capturedCustomContext = input.context
        return 'Custom OK'
      },
    },
  )

  assert.equal(capturedCustomContext, 'Page context section details')
})

test('complete_panel_ai passes saved configuration context to Mistral and Custom Provider', async () => {
  let capturedMistralContext = ''
  let capturedCustomContext = ''

  await complete_panel_ai(
    {
      runtime: { provider: 'mistral', customModel: null, customReasoningMode: 'omit', fallbackEnabled: false },
      persona: 'Persona',
      context: 'Saved module configuration details',
      messages: natural_messages,
    },
    {
      mistralAgentId: 'agent-1',
      startMistralConversation: async (req) => {
        capturedMistralContext = req.inputs[0]?.content ?? ''
        return { outputs: [{ type: 'message.output', content: 'Mistral OK' }] }
      },
    },
  )

  assert.ok(capturedMistralContext.includes('Saved module configuration details'))

  await complete_panel_ai(
    {
      runtime: { provider: 'custom', customModel: 'opaque/model', customReasoningMode: 'omit', fallbackEnabled: false },
      persona: 'Persona',
      context: 'Saved module configuration details',
      messages: natural_messages,
    },
    {
      completeWithCustomProvider: async (input) => {
        capturedCustomContext = input.context
        return 'Custom OK'
      },
    },
  )

  assert.equal(capturedCustomContext, 'Saved module configuration details')
})

test('provider parity keeps unavailable module context out of natural conversation messages', async () => {
  let capturedMistralInputs: any[] = []
  let capturedCustomMessages: any[] = []

  await complete_panel_ai(
    {
      runtime: { provider: 'mistral', customModel: null, customReasoningMode: 'omit', fallbackEnabled: false },
      persona: 'Persona',
      context: 'Transient context with status: unavailable',
      messages: natural_messages,
    },
    {
      mistralAgentId: 'agent-1',
      startMistralConversation: async (req) => {
        capturedMistralInputs = req.inputs
        return { outputs: [{ type: 'message.output', content: 'Mistral OK' }] }
      },
    },
  )

  assert.equal(capturedMistralInputs.length, 4)
  assert.equal(capturedMistralInputs[0]?.content.includes('status: unavailable'), true)
  assert.deepEqual(
    capturedMistralInputs.slice(1).map((m) => ({ role: m.role, content: m.content })),
    natural_messages,
  )

  await complete_panel_ai(
    {
      runtime: { provider: 'custom', customModel: 'opaque/model', customReasoningMode: 'omit', fallbackEnabled: false },
      persona: 'Persona',
      context: 'Transient context with status: unavailable',
      messages: natural_messages,
    },
    {
      completeWithCustomProvider: async (input) => {
        const payload = build_custom_provider_payload({ ...input, reasoningMode: 'omit' })
        capturedCustomMessages = payload.messages
        return 'Custom OK'
      },
    },
  )

  assert.equal(capturedCustomMessages.length, 5)
  assert.equal(capturedCustomMessages[0]?.role, 'system')
  assert.equal(capturedCustomMessages[1]?.role, 'system')
  assert.equal(capturedCustomMessages[1]?.content.includes('status: unavailable'), true)
  assert.deepEqual(capturedCustomMessages.slice(2), natural_messages)
})

test('runtime event logger receives safe events and logger exceptions do not break execution', async () => {
  const loggedEvents: panel_ai_runtime_event[] = []

  const result = await complete_panel_ai(
    {
      runtime: { provider: 'mistral', customModel: 'opaque/fallback-model', customReasoningMode: 'high', fallbackEnabled: true },
      persona: 'Private secret persona',
      context: 'Secret context',
      messages: natural_messages,
    },
    {
      mistralAgentId: 'agent-1',
      customProviderConfigured: true,
      startMistralConversation: async () => {
        throw create_mistral_error(429)
      },
      completeWithCustomProvider: async () => 'FALLBACK SUCCESS',
      logEvent: (event) => {
        loggedEvents.push(event)
        throw new Error('Logger internal failure')
      },
    },
  )

  assert.equal(result, 'FALLBACK SUCCESS')
  assert.equal(loggedEvents.length, 2)
  assert.equal(loggedEvents[0]?.type, 'fallback_attempted')
  assert.equal(loggedEvents[0]?.category, 'rate_limited')
  assert.equal(loggedEvents[0]?.statusCode, 429)
  assert.equal(loggedEvents[0]?.modelId, 'opaque/fallback-model')

  assert.equal(loggedEvents[1]?.type, 'fallback_succeeded')
  assert.equal(loggedEvents[1]?.success, true)

  const serialized = JSON.stringify(loggedEvents)
  assert.equal(serialized.includes('Private secret persona'), false)
  assert.equal(serialized.includes('Secret context'), false)
})
