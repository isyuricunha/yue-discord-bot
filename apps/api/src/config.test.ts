import test from 'node:test'
import assert from 'node:assert/strict'

import { assert_api_runtime_env, get_api_runtime_env_errors } from './config'

function valid_runtime_env(): NodeJS.ProcessEnv {
  return {
    DISCORD_CLIENT_ID: 'discord-client-id',
    DISCORD_CLIENT_SECRET: 'discord-client-secret',
    JWT_SECRET: 'j'.repeat(32),
    DATABASE_URL: 'postgresql://localhost/yuebot',
    INTERNAL_API_SECRET: 'i'.repeat(32),
  }
}

test('config can be imported without runtime credentials', () => {
  assert.equal(typeof get_api_runtime_env_errors, 'function')
})

test('runtime validation reports all missing required credentials', () => {
  assert.deepEqual(get_api_runtime_env_errors({}), [
    'Missing required environment variables: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, JWT_SECRET, DATABASE_URL, INTERNAL_API_SECRET',
  ])
})

test('runtime validation accepts a valid development environment', () => {
  assert.doesNotThrow(() => assert_api_runtime_env(valid_runtime_env()))
})

test('runtime validation enforces secret lengths', () => {
  const env = valid_runtime_env()
  env.JWT_SECRET = 'short'
  env.INTERNAL_API_SECRET = 'short'

  assert.deepEqual(get_api_runtime_env_errors(env), [
    'JWT_SECRET must be at least 32 characters long',
    'INTERNAL_API_SECRET must be at least 32 characters long',
  ])
})

test('runtime validation enforces production URLs and secure cross-site cookies', () => {
  const env = valid_runtime_env()
  env.NODE_ENV = 'production'
  env.COOKIE_SAMESITE = 'none'
  env.COOKIE_SECURE = 'false'

  assert.deepEqual(get_api_runtime_env_errors(env), [
    'WEB_URL (or FRONTEND_URL) must be set in production',
    'DISCORD_REDIRECT_URI must be set in production',
    'COOKIE_SAMESITE=none requires COOKIE_SECURE=true',
  ])
})
