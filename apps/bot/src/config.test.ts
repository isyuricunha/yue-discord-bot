import test from 'node:test'
import assert from 'node:assert/strict'

import { assert_bot_runtime_env } from './config'

// Smoke do gate de boot: o runtime se recusa a subir sem as envs obrigatórias.
// Cada teste controla o process.env com restore em finally; o worker isolado
// por arquivo do node --test impede o vazamento para outros arquivos.

const MINIMUM: Record<string, string> = {
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_TOKEN: 'dev-token',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/yuebot',
  INTERNAL_API_SECRET: 's'.repeat(32),
}

function run_with_env(overrides: Record<string, string | undefined>, fn: () => void): void {
  const keys = [...Object.keys(MINIMUM), ...Object.keys(overrides)]
  const saved: Record<string, string | undefined> = {}
  for (const key of keys) saved[key] = process.env[key]
  try {
    for (const key of keys) delete process.env[key]
    for (const [key, value] of Object.entries(MINIMUM)) process.env[key] = value
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    fn()
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('assert_bot_runtime_env passa com o conjunto mínimo de envs', () => {
  run_with_env({}, () => assert.doesNotThrow(() => assert_bot_runtime_env()))
})

test('assert_bot_runtime_env falha sem cada env obrigatória', () => {
  for (const missing of ['DISCORD_CLIENT_ID', 'DISCORD_TOKEN', 'DATABASE_URL', 'INTERNAL_API_SECRET']) {
    run_with_env({ [missing]: undefined }, () =>
      assert.throws(() => assert_bot_runtime_env(), new RegExp(`faltando: ${missing}`)),
    )
  }
})

test('assert_bot_runtime_env exige INTERNAL_API_SECRET com 32+ caracteres', () => {
  run_with_env({ INTERNAL_API_SECRET: 'curto' }, () =>
    assert.throws(() => assert_bot_runtime_env(), /32 caracteres/),
  )
})

test('LIVEPIX_ENABLED=true exige credenciais livepix e url de retorno', () => {
  run_with_env({ LIVEPIX_ENABLED: 'true' }, () =>
    assert.throws(() => assert_bot_runtime_env(), /LIVEPIX_CLIENT_ID/),
  )

  run_with_env(
    {
      LIVEPIX_ENABLED: 'true',
      LIVEPIX_CLIENT_ID: 'id',
      LIVEPIX_CLIENT_SECRET: 'secret',
      LIVEPIX_TOKEN_ENCRYPTION_KEY: 'k'.repeat(32),
    },
    () => assert.throws(() => assert_bot_runtime_env(), /RETURN_URL/),
  )

  run_with_env(
    {
      LIVEPIX_ENABLED: 'true',
      LIVEPIX_CLIENT_ID: 'id',
      LIVEPIX_CLIENT_SECRET: 'secret',
      LIVEPIX_TOKEN_ENCRYPTION_KEY: 'k'.repeat(32),
      LIVEPIX_PAYMENT_RETURN_URL: 'https://example.com/return',
    },
    () => assert.doesNotThrow(() => assert_bot_runtime_env()),
  )
})
