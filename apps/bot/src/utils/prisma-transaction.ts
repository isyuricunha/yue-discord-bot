import { prisma, Prisma } from '@yuebot/database'

type TransactionHost = Pick<typeof prisma, '$transaction'>

type SerializableRetryOptions = {
  max_attempts?: number
  transaction_host?: TransactionHost
}

export function is_serializable_conflict(error: unknown): boolean {
  const code = typeof (error as { code?: unknown })?.code === 'string'
    ? (error as { code: string }).code
    : ''

  return code === 'P2034' || code === '40001'
}

export async function with_serializable_retry<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: SerializableRetryOptions = {},
): Promise<T> {
  const max_attempts = Math.max(1, options.max_attempts ?? 5)
  const transaction_host = options.transaction_host ?? prisma

  for (let attempt = 1; attempt <= max_attempts; attempt += 1) {
    try {
      return await transaction_host.$transaction(
        async (transaction) => await operation(transaction),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      if (!is_serializable_conflict(error) || attempt === max_attempts) {
        throw error
      }
    }
  }

  throw new Error('Serializable transaction retry loop exhausted')
}
