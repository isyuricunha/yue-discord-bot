export type coin_side = 'heads' | 'tails'

type verify_coinflip_result_input = {
  serverSeed: string
  serverSeedHash: string
  gameId: string
  resultSide: coin_side
}

function bytes_to_hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function utf8_bytes(input: string): Uint8Array {
  return new TextEncoder().encode(input)
}

function to_array_buffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function sha256_bytes(input: string): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto subtle API is not available')
  }

  const data = to_array_buffer(utf8_bytes(input))
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hash)
}

export async function sha256_hex(input: string): Promise<string> {
  return bytes_to_hex(await sha256_bytes(input))
}

export function generate_server_seed_hex(byte_length = 32): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('WebCrypto getRandomValues is not available')
  }

  const bytes = new Uint8Array(byte_length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes_to_hex(bytes)
}

export async function compute_server_seed_hash(server_seed: string): Promise<string> {
  return await sha256_hex(server_seed)
}

export async function compute_coinflip_result_side(input: {
  serverSeed: string
  gameId: string
}): Promise<coin_side> {
  const hash = await sha256_bytes(`${input.serverSeed}:${input.gameId}`)
  return (hash[0] & 1) === 0 ? 'heads' : 'tails'
}

export async function verify_coinflip_result(
  input: verify_coinflip_result_input
): Promise<{ ok: true } | { ok: false; reason: 'seed_hash_mismatch' | 'result_side_mismatch' }> {
  const computed_hash = await compute_server_seed_hash(input.serverSeed)
  if (computed_hash !== input.serverSeedHash) {
    return { ok: false, reason: 'seed_hash_mismatch' }
  }

  const computed_side = await compute_coinflip_result_side({
    serverSeed: input.serverSeed,
    gameId: input.gameId,
  })

  if (computed_side !== input.resultSide) {
    return { ok: false, reason: 'result_side_mismatch' }
  }

  return { ok: true }
}
