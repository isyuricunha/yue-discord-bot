import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolve_ai_moderation_provider,
  should_run_ai_moderation,
} from './automod.ai_provider'

function with_env(env: { openai?: string; mistral?: string }, run: () => void) {
  const openai_backup = process.env.OPENAI_API_KEY
  const mistral_backup = process.env.MISTRAL_API_KEY
  try {
    if (env.openai === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = env.openai
    if (env.mistral === undefined) delete process.env.MISTRAL_API_KEY
    else process.env.MISTRAL_API_KEY = env.mistral
    run()
  } finally {
    if (openai_backup === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = openai_backup
    if (mistral_backup === undefined) delete process.env.MISTRAL_API_KEY
    else process.env.MISTRAL_API_KEY = mistral_backup
  }
}

test('resolve_ai_moderation_provider: mistral resolves to mistral, anything else to openai', () => {
  assert.equal(resolve_ai_moderation_provider('mistral'), 'mistral')
  assert.equal(resolve_ai_moderation_provider('openai'), 'openai')
  assert.equal(resolve_ai_moderation_provider(undefined), 'openai')
  assert.equal(resolve_ai_moderation_provider('bogus'), 'openai')
  assert.equal(resolve_ai_moderation_provider(null), 'openai')
})

test('should_run_ai_moderation: openai key alone keeps both providers runnable', () => {
  with_env({ openai: 'k', mistral: undefined }, () => {
    assert.equal(should_run_ai_moderation('openai', false), true)
    assert.equal(should_run_ai_moderation('mistral', false), true)
    assert.equal(should_run_ai_moderation('mistral', true), true)
  })
})

test('should_run_ai_moderation: mistral-only deployment runs mistral but not openai primary', () => {
  with_env({ openai: undefined, mistral: 'k' }, () => {
    assert.equal(should_run_ai_moderation('mistral', false), true)
    assert.equal(should_run_ai_moderation('openai', false), false, 'no openai key and fallback off')
    assert.equal(should_run_ai_moderation('openai', true), true, 'fallback runs on the mistral key')
  })
})

test('should_run_ai_moderation: mistral primary without its key still runs for openai images', () => {
  with_env({ openai: 'k', mistral: undefined }, () => {
    assert.equal(should_run_ai_moderation('mistral', false), true)
  })
})

test('should_run_ai_moderation: whitespace-only keys count as missing, matching the API', () => {
  with_env({ openai: '   ', mistral: '  ' }, () => {
    assert.equal(should_run_ai_moderation('openai', false), false)
    assert.equal(should_run_ai_moderation('mistral', false), false)
    assert.equal(should_run_ai_moderation('openai', true), false)
  })
  with_env({ openai: '   ', mistral: 'k' }, () => {
    assert.equal(should_run_ai_moderation('openai', true), true)
    assert.equal(should_run_ai_moderation('openai', false), false)
  })
})

test('should_run_ai_moderation: no keys at all skips the flow', () => {
  with_env({ openai: undefined, mistral: undefined }, () => {
    assert.equal(should_run_ai_moderation('openai', false), false)
    assert.equal(should_run_ai_moderation('mistral', false), false)
    assert.equal(should_run_ai_moderation('openai', true), false)
    assert.equal(should_run_ai_moderation('mistral', true), false)
  })
})
