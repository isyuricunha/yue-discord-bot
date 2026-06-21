import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

function decode_base64url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function encode_base64url(value: Buffer): string {
  return value.toString('base64url')
}

export function parse_livepix_encryption_key(raw_key: string): Buffer {
  const trimmed = raw_key.trim()
  if (!trimmed) {
    throw new Error('LIVEPIX_TOKEN_ENCRYPTION_KEY is required')
  }

  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  const base64_candidate = /^[A-Za-z0-9+/=_-]+$/.test(trimmed) ? Buffer.from(trimmed, 'base64') : null
  if (base64_candidate?.byteLength === KEY_BYTES) {
    return base64_candidate
  }

  const utf8_candidate = Buffer.from(trimmed, 'utf8')
  if (utf8_candidate.byteLength !== KEY_BYTES) {
    throw new Error('LIVEPIX_TOKEN_ENCRYPTION_KEY must decode to 32 bytes')
  }

  return utf8_candidate
}

export function encrypt_livepix_secret(plaintext: string, raw_key: string): string {
  const key = parse_livepix_encryption_key(raw_key)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    'v1',
    encode_base64url(iv),
    encode_base64url(tag),
    encode_base64url(ciphertext),
  ].join(':')
}

export function decrypt_livepix_secret(payload: string, raw_key: string): string {
  const key = parse_livepix_encryption_key(raw_key)
  const [version, iv_raw, tag_raw, ciphertext_raw] = payload.split(':')

  if (version !== 'v1' || !iv_raw || !tag_raw || !ciphertext_raw) {
    throw new Error('Invalid encrypted LivePix secret format')
  }

  const iv = decode_base64url(iv_raw)
  const tag = decode_base64url(tag_raw)
  const ciphertext = decode_base64url(ciphertext_raw)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
