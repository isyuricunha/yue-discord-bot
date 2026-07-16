import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalize_custom_provider_reasoning_mode,
  custom_reasoning_parameters,
  custom_provider_endpoint,
  build_custom_provider_payload,
  extract_custom_provider_text
} from './custom_provider'

test('normalize_custom_provider_reasoning_mode', () => {
  assert.equal(normalize_custom_provider_reasoning_mode('none'), 'none')
  assert.equal(normalize_custom_provider_reasoning_mode('minimal'), 'minimal')
  assert.equal(normalize_custom_provider_reasoning_mode('low'), 'low')
  assert.equal(normalize_custom_provider_reasoning_mode('medium'), 'medium')
  assert.equal(normalize_custom_provider_reasoning_mode('high'), 'high')
  assert.equal(normalize_custom_provider_reasoning_mode('omit'), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode(null), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode(123), 'omit')
  assert.equal(normalize_custom_provider_reasoning_mode('ultra'), 'omit')
})

test('custom_reasoning_parameters', () => {
  assert.deepEqual(custom_reasoning_parameters('omit'), {})
  assert.deepEqual(custom_reasoning_parameters('none'), { reasoning_effort: 'none' })
  assert.deepEqual(custom_reasoning_parameters('minimal'), { reasoning_effort: 'minimal' })
  assert.deepEqual(custom_reasoning_parameters('low'), { reasoning_effort: 'low' })
  assert.deepEqual(custom_reasoning_parameters('medium'), { reasoning_effort: 'medium' })
  assert.deepEqual(custom_reasoning_parameters('high'), { reasoning_effort: 'high' })
})

test('custom_provider_endpoint', () => {
  assert.equal(custom_provider_endpoint('https://api.openai.com/v1', '/chat/completions'), 'https://api.openai.com/v1/chat/completions')
  assert.equal(custom_provider_endpoint('https://api.openai.com', '/chat/completions'), 'https://api.openai.com/v1/chat/completions')
  assert.equal(custom_provider_endpoint('https://api.openai.com/', '/chat/completions'), 'https://api.openai.com/v1/chat/completions')
  assert.equal(custom_provider_endpoint('http://localhost:8080', '/chat/completions'), 'http://localhost:8080/v1/chat/completions')
  assert.throws(() => custom_provider_endpoint('ftp://invalid.com', '/chat'), /must use HTTP or HTTPS/)
  assert.equal(custom_provider_endpoint('', '/chat'), null)
})

test('build_custom_provider_payload', () => {
  const payload = build_custom_provider_payload({
    model: 'my-model',
    messages: [{ role: 'user', content: 'hello' }],
    reasoningMode: 'high',
    temperature: 0.5
  })
  assert.deepEqual(payload, {
    model: 'my-model',
    messages: [{ role: 'user', content: 'hello' }],
    temperature: 0.5,
    reasoning_effort: 'high'
  })

  const payloadOmit = build_custom_provider_payload({
    model: 'my-model',
    messages: [{ role: 'user', content: 'hello' }],
    reasoningMode: 'omit'
  })
  assert.deepEqual(payloadOmit, {
    model: 'my-model',
    messages: [{ role: 'user', content: 'hello' }],
    temperature: 0.4
  })
})

test('extract_custom_provider_text', () => {
  assert.equal(
    extract_custom_provider_text({ choices: [{ message: { content: ' hello ' } }] }),
    'hello'
  )
  assert.throws(() => extract_custom_provider_text({ choices: [] }), /empty response/)
  assert.throws(() => extract_custom_provider_text({ choices: [{ message: { content: '' } }] }), /empty response/)
  assert.throws(() => extract_custom_provider_text(null), /empty response/)
})
