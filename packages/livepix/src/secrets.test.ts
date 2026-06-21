import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decrypt_livepix_secret,
  encrypt_livepix_secret,
  parse_livepix_encryption_key,
} from './secrets'

const RAW_KEY = '12345678901234567890123456789012'

test('LivePix secret encryption round-trips without deterministic ciphertext', () => {
  const first = encrypt_livepix_secret('access-token-value', RAW_KEY)
  const second = encrypt_livepix_secret('access-token-value', RAW_KEY)

  assert.notEqual(first, second)
  assert.equal(decrypt_livepix_secret(first, RAW_KEY), 'access-token-value')
  assert.equal(decrypt_livepix_secret(second, RAW_KEY), 'access-token-value')
})

test('LivePix secret encryption rejects invalid keys and wrong decrypt keys', () => {
  const encrypted = encrypt_livepix_secret('access-token-value', RAW_KEY)

  assert.throws(() => parse_livepix_encryption_key('short'), /32 bytes/)
  assert.throws(() => decrypt_livepix_secret(encrypted, 'abcdefghijklmnopqrstuvwxzy123456'))
})

test('LivePix encryption key parser accepts hex, base64, and raw 32-byte keys', () => {
  const base64Key = Buffer.alloc(32, 1).toString('base64')

  assert.equal(parse_livepix_encryption_key('a'.repeat(64)).byteLength, 32)
  assert.equal(parse_livepix_encryption_key(base64Key).byteLength, 32)
  assert.equal(parse_livepix_encryption_key(RAW_KEY).byteLength, 32)
})
