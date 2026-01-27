const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function get_random_bytes(size: number): Uint8Array {
  const crypto_obj = (globalThis as unknown as { crypto?: { getRandomValues?: unknown } }).crypto
  const get_random_values = crypto_obj?.getRandomValues

  if (typeof get_random_values !== 'function') {
    throw new Error('Web Crypto is not available in this runtime')
  }

  const buf = new Uint8Array(size)
  ;(get_random_values as (array: Uint8Array) => Uint8Array)(buf)
  return buf
}

export function generate_public_id(length = 10): string {
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error('length must be a positive integer')
  }

  const out: string[] = []
  const alpha_len = alphabet.length

  // Avoid modulo bias.
  const max = 256 - (256 % alpha_len)

  while (out.length < length) {
    const bytes = get_random_bytes(Math.max(16, length))

    for (let i = 0; i < bytes.length && out.length < length; i += 1) {
      const v = bytes[i]!
      if (v >= max) continue
      out.push(alphabet[v % alpha_len]!)
    }
  }

  return out.join('')
}
