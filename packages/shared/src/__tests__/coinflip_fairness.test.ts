import test from 'node:test'
import assert from 'node:assert/strict'

import {
  compute_coinflip_result_side,
  compute_server_seed_hash,
  verify_coinflip_result,
} from '../coinflip_fairness'

test('coinflip_fairness: serverSeedHash matches sha256(serverSeed)', async () => {
  const serverSeed = 'deadbeef'
  const serverSeedHash = await compute_server_seed_hash(serverSeed)

  assert.equal(serverSeedHash.length, 64)
  assert.ok(/^[0-9a-f]+$/.test(serverSeedHash))

  const recomputed = await compute_server_seed_hash(serverSeed)
  assert.equal(recomputed, serverSeedHash)
})

test('coinflip_fairness: verify_coinflip_result ok', async () => {
  const gameId = 'game_123'
  const serverSeed = 'server_seed_abc'
  const serverSeedHash = await compute_server_seed_hash(serverSeed)
  const resultSide = await compute_coinflip_result_side({ serverSeed, gameId })

  const res = await verify_coinflip_result({
    gameId,
    serverSeed,
    serverSeedHash,
    resultSide,
  })

  assert.deepEqual(res, { ok: true })
})

test('coinflip_fairness: verify_coinflip_result detects seed hash mismatch', async () => {
  const gameId = 'game_123'
  const serverSeed = 'server_seed_abc'
  const resultSide = await compute_coinflip_result_side({ serverSeed, gameId })

  const res = await verify_coinflip_result({
    gameId,
    serverSeed,
    serverSeedHash: '0'.repeat(64),
    resultSide,
  })

  assert.deepEqual(res, { ok: false, reason: 'seed_hash_mismatch' })
})

test('coinflip_fairness: verify_coinflip_result detects result side mismatch', async () => {
  const gameId = 'game_123'
  const serverSeed = 'server_seed_abc'
  const serverSeedHash = await compute_server_seed_hash(serverSeed)
  const realSide = await compute_coinflip_result_side({ serverSeed, gameId })
  const wrongSide = realSide === 'heads' ? 'tails' : 'heads'

  const res = await verify_coinflip_result({
    gameId,
    serverSeed,
    serverSeedHash,
    resultSide: wrongSide,
  })

  assert.deepEqual(res, { ok: false, reason: 'result_side_mismatch' })
})
