import test from 'node:test'
import assert from 'node:assert/strict'

import type { Prisma } from '@yuebot/database'

import { is_serializable_conflict, with_serializable_retry } from './prisma-transaction'

function adapter_pg_conflict(): Error & {
  cause: {
    originalCode: string
    originalMessage: string
    kind: string
  }
} {
  return Object.assign(new Error('TransactionWriteConflict'), {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '40001',
      originalMessage: 'could not serialize access due to read/write dependencies among transactions',
      kind: 'TransactionWriteConflict',
    },
  })
}

test('is_serializable_conflict recognizes adapter-pg DriverAdapterError conflicts', () => {
  assert.equal(is_serializable_conflict(adapter_pg_conflict()), true)
})

test('with_serializable_retry retries adapter-pg DriverAdapterError conflicts', async () => {
  let attempts = 0
  const transaction_host = {
    $transaction: async (
      operation: (transaction: Prisma.TransactionClient) => Promise<unknown>,
    ) => {
      attempts += 1
      if (attempts < 3) throw adapter_pg_conflict()
      return await operation({} as Prisma.TransactionClient)
    },
  } as any

  const result = await with_serializable_retry(async () => 'committed', {
    max_attempts: 3,
    transaction_host,
    retry_base_delay_ms: 0,
  })

  assert.equal(result, 'committed')
  assert.equal(attempts, 3)
})
