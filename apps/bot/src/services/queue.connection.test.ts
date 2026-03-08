import test from 'node:test'
import assert from 'node:assert/strict'

import { resolve_redis_password } from './queue.connection'

test('resolve_redis_password: returns undefined when url already has password', () => {
  assert.equal(resolve_redis_password('redis://:secret@localhost:6379', 'env_secret'), undefined)
})

test('resolve_redis_password: uses env password when url has no password', () => {
  assert.equal(resolve_redis_password('redis://localhost:6379', ' env_secret '), 'env_secret')
})

test('resolve_redis_password: returns undefined when env password is empty/whitespace', () => {
  assert.equal(resolve_redis_password('redis://localhost:6379', '   '), undefined)
})
