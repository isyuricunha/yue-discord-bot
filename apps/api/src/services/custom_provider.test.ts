import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalize_custom_provider_models,
  test_custom_provider_model,
} from './custom_provider'
import {
  custom_provider_endpoint,
  custom_reasoning_parameters,
  normalize_custom_provider_reasoning_mode,
  type custom_provider_reasoning_mode,
} from '@yuebot/shared'

test('preserves opaque provider model IDs and sorts by their first segment', () => {
  const models = normalize_custom_provider_models([
    'zeta/large',
    'custom/alpha/model',
    'alpha/small',
    'alpha/large',
    'custom/alpha/model',
    '',
    null,
  ])

  assert.deepEqual(models, [
    { id: 'alpha/large', group: 'alpha', label: 'large' },
    { id: 'alpha/small', group: 'alpha', label: 'small' },
    { id: 'custom/alpha/model', group: 'custom', label: 'alpha/model' },
    { id: 'zeta/large', group: 'zeta', label: 'large' },
  ])
})

test('uses the standard OpenAI-compatible v1 endpoints', () => {
  assert.equal(custom_provider_endpoint('https://provider.example', '/models'), 'https://provider.example/v1/models')
  assert.equal(custom_provider_endpoint('https://provider.example/v1/', '/models'), 'https://provider.example/v1/models')
  assert.throws(() => custom_provider_endpoint('ftp://provider.example', '/models'), /HTTP or HTTPS/)
})

test('normalizes custom reasoning mode strictly defaulting invalid values to omit', () => {
  assert.equal(normalize_custom_provider_reasoning_mode('omit'), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode('none'), 'none')
  assert.equal(normalize_custom_provider_reasoning_mode('minimal'), 'minimal')
  assert.equal(normalize_custom_provider_reasoning_mode('low'), 'low')
  assert.equal(normalize_custom_provider_reasoning_mode('medium'), 'medium')
  assert.equal(normalize_custom_provider_reasoning_mode('high'), 'high')

  assert.equal(normalize_custom_provider_reasoning_mode(true), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode(false), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode(null), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode(undefined), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode('invalid_mode'), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode(123), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode(['high']), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode({ mode: 'high' }), 'omit')
})

test('custom_reasoning_parameters output for omit', () => {
  const params = custom_reasoning_parameters('omit')
  assert.deepEqual(params, {})
  assert.equal(Object.hasOwn(params, 'reasoning_effort'), false)
  assert.equal(Object.hasOwn(params, 'reasoning'), false)
  assert.equal(Object.hasOwn(params, 'thinking'), false)
  assert.equal(Object.hasOwn(params, 'think'), false)
})

test('custom_reasoning_parameters output for none', () => {
  const params = custom_reasoning_parameters('none')
  assert.deepEqual(params, { reasoning_effort: 'none' })
  assert.equal(Object.hasOwn(params, 'reasoning'), false)
})

test('custom_reasoning_parameters output for minimal', () => {
  const params = custom_reasoning_parameters('minimal')
  assert.deepEqual(params, { reasoning_effort: 'minimal' })
  assert.equal(Object.hasOwn(params, 'reasoning'), false)
})

test('custom_reasoning_parameters output for low', () => {
  const params = custom_reasoning_parameters('low')
  assert.deepEqual(params, { reasoning_effort: 'low' })
  assert.equal(Object.hasOwn(params, 'reasoning'), false)
})

test('custom_reasoning_parameters output for medium', () => {
  const params = custom_reasoning_parameters('medium')
  assert.deepEqual(params, { reasoning_effort: 'medium' })
  assert.equal(Object.hasOwn(params, 'reasoning'), false)
})

test('custom_reasoning_parameters output for high', () => {
  const params = custom_reasoning_parameters('high')
  assert.deepEqual(params, { reasoning_effort: 'high' })
  assert.equal(Object.hasOwn(params, 'reasoning'), false)
})

test('generic model compatibility pairs opaque fixture IDs with reasoning modes without capability inference', () => {
  const fixtureModelIds = [
    'provider/reasoning-model',
    'provider/plain-model',
    'alias/future-model',
    'custom/unknown-model',
  ]
  const modes: custom_provider_reasoning_mode[] = ['omit', 'none', 'minimal', 'low', 'medium', 'high']

  for (const modelId of fixtureModelIds) {
    for (const mode of modes) {
      const params = custom_reasoning_parameters(mode)
      const payload = {
        model: modelId,
        messages: [{ role: 'user', content: 'hello' }],
        ...params,
      }

      assert.equal(payload.model, modelId, 'Model ID must remain completely unchanged')
      if (mode === 'omit') {
        assert.equal(Object.hasOwn(payload, 'reasoning_effort'), false)
      } else {
        assert.equal((payload as Record<string, unknown>).reasoning_effort, mode)
      }
      assert.equal(Object.hasOwn(payload, 'reasoning'), false)
    }
  }
})

test('test_custom_provider_model builds request with max_tokens 512 and exact reasoning_effort for all 6 modes', async () => {
  const modes: custom_provider_reasoning_mode[] = ['omit', 'none', 'minimal', 'low', 'medium', 'high']
  const modelId = 'opaque/fixture-model'

  for (const mode of modes) {
    let callCount = 0
    let capturedInit: RequestInit | null = null

    const result = await test_custom_provider_model(
      modelId,
      mode,
      {
        resolveEndpoint: () => 'https://example.invalid/v1/chat/completions',
        requestJson: async (_url, init) => {
          callCount += 1
          capturedInit = init
          return { choices: [{ message: { content: 'OK' } }] }
        },
      },
    )

    assert.equal(callCount, 1, 'Must make exactly 1 request')
    assert.equal(result.model, modelId)
    assert.equal(result.reasoningMode, mode)

    const payload = JSON.parse(capturedInit!.body as string)
    assert.equal(payload.model, modelId, 'Model ID must remain unchanged')
    assert.equal(payload.max_tokens, 512, 'max_tokens must be at least 512')
    assert.equal(payload.temperature, 0, 'temperature must be 0')
    assert.equal(Object.hasOwn(payload, 'reasoning'), false)
    assert.equal(Object.hasOwn(payload, 'thinking'), false)

    if (mode === 'omit') {
      assert.equal(Object.hasOwn(payload, 'reasoning_effort'), false)
    } else {
      assert.equal(payload.reasoning_effort, mode)
    }
  }
})

test('test_custom_provider_model response validation handling', async () => {
  const modelId = 'opaque/test-model'

  // Valid response
  const validRes = await test_custom_provider_model(modelId, 'omit', {
    resolveEndpoint: () => 'https://example.invalid/v1/chat/completions',
    requestJson: async () => ({ choices: [{ message: { content: ' Valid output ' } }] }),
  })
  assert.equal(validRes.model, modelId)

  // Malformed / empty response cases expecting Panel AI returned an empty response
  const invalidResponses = [
    null,
    {},
    { choices: [] },
    { choices: [{}] },
    { choices: [{ message: {} }] },
    { choices: [{ message: { content: '' } }] },
    { choices: [{ message: { content: '   ' } }] },
    { choices: [{ message: { content: 123 } }] },
  ]

  for (const invalidBody of invalidResponses) {
    await assert.rejects(
      () =>
        test_custom_provider_model(modelId, 'omit', {
          resolveEndpoint: () => 'https://example.invalid/v1/chat/completions',
          requestJson: async () => invalidBody,
        }),
      /Panel AI returned an empty response/,
    )
  }

  // Upstream HTTP failure remains safe failure
  await assert.rejects(
    () =>
      test_custom_provider_model(modelId, 'omit', {
        resolveEndpoint: () => 'https://example.invalid/v1/chat/completions',
        requestJson: async () => {
          throw new Error('Custom Provider HTTP 500')
        },
      }),
    /Custom Provider HTTP 500/,
  )
})
