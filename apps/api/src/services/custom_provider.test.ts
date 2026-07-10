import assert from 'node:assert/strict'
import test from 'node:test'

import { custom_provider_endpoint, normalize_custom_provider_models } from './custom_provider'

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
