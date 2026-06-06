import test from 'node:test'
import assert from 'node:assert/strict'

import type { Prisma } from '@yuebot/database'

import { is_serializable_conflict, with_serializable_retry } from './prisma-transaction'

function make_transaction_host(run: () => Promise<unknown>) {
  return {
    $transaction: async (
      operation: (transaction: Prisma.TransactionClient) => Promise<unknown>,
    ) => {
      const result = await run()
      return result === undefined
        ? await operation({} as Prisma.TransactionClient)
        : result
    },
  } as any
}

test('is_serializable_conflict recognizes Prisma and PostgreSQL conflict codes', () => {
  assert.equal(is_serializable_conflict({ code: 'P2034' }), true)
  assert.equal(is_serializable_conflict({ code: '40001' }), true)
  assert.equal(is_serializable_conflict({ code: 'P2002' }), false)
  assert.equal(is_serializable_conflict(new Error('failure')), false)
})

test('with_serializable_retry retries conflicts and returns the transaction result', async () => {
  let attempts = 0
  const transaction_host = make_transaction_host(async () => {
    attempts += 1
    if (attempts < 3) throw Object.assign(new Error('conflict'), { code: 'P2034' })
    return undefined
  })

  const result = await with_serializable_retry(async () => 'committed', {
    max_attempts: 3,
    transaction_host,
  })

  assert.equal(result, 'committed')
  assert.equal(attempts, 3)
})

test('with_serializable_retry stops at the configured conflict limit', async () => {
  let attempts = 0
  const transaction_host = make_transaction_host(async () => {
    attempts += 1
    throw Object.assign(new Error('conflict'), { code: '40001' })
  })

  await assert.rejects(
    with_serializable_retry(async () => 'unreachable', {
      max_attempts: 2,
      transaction_host,
    }),
    /conflict/,
  )
  assert.equal(attempts, 2)
})

test('with_serializable_retry does not retry unrelated failures', async () => {
  let attempts = 0
  const transaction_host = make_transaction_host(async () => {
    attempts += 1
    throw Object.assign(new Error('unique violation'), { code: 'P2002' })
  })

  await assert.rejects(
    with_serializable_retry(async () => 'unreachable', { transaction_host }),
    /unique violation/,
  )
  assert.equal(attempts, 1)
})
