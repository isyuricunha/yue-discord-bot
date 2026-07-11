import assert from 'node:assert/strict'
import test from 'node:test'

import { PANEL_CONTRACT_RULES } from './panel_context'
import {
  build_custom_provider_messages,
  build_mistral_agent_request,
  complete_panel_ai,
  extract_mistral_text,
  test_panel_ai_runtime,
  type mistral_agent_request,
  type panel_ai_message,
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
    runtime: { provider: 'mistral', customModel: null },
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
    { provider: 'mistral', customModel: null },
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
