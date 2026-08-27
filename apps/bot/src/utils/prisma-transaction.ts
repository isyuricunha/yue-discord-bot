import { prisma, Prisma } from '@yuebot/database'

type TransactionHost = Pick<typeof prisma, '$transaction'>

type SerializableRetryOptions = {
  max_attempts?: number
  transaction_host?: TransactionHost
  retry_base_delay_ms?: number
  retry_max_delay_ms?: number
  sleep?: (delay_ms: number) => Promise<void>
  random?: () => number
}

const default_sleep = async (delay_ms: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, delay_ms))
}

export function is_serializable_conflict(error: unknown): boolean {
  const code = typeof (error as { code?: unknown })?.code === 'string'
    ? (error as { code: string }).code
    : ''

  return code === 'P2034' || code === '40001'
}

export function serializable_retry_delay_ms(
  attempt: number,
  base_delay_ms = 10,
  max_delay_ms = 250,
  random = Math.random,
): number {
  const base = Math.max(0, Math.trunc(base_delay_ms))
  const max = Math.max(base, Math.trunc(max_delay_ms))
  if (base === 0) return 0

  const exponent = Math.max(0, Math.min(10, attempt - 1))
  const cap = Math.min(max, base * (2 ** exponent))
  const floor = Math.floor(cap / 2)
  const sample = Math.min(0.9999999999999999, Math.max(0, random()))
  return floor + Math.floor(sample * (cap - floor + 1))
}

export async function with_serializable_retry<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: SerializableRetryOptions = {},
): Promise<T> {
  const max_attempts = Math.max(1, options.max_attempts ?? 5)
  const transaction_host = options.transaction_host ?? prisma
  const sleep = options.sleep ?? default_sleep
  const random = options.random ?? Math.random

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

      const delay_ms = serializable_retry_delay_ms(
        attempt,
        options.retry_base_delay_ms,
        options.retry_max_delay_ms,
        random,
      )
      if (delay_ms > 0) await sleep(delay_ms)
    }
  }

  throw new Error('Serializable transaction retry loop exhausted')
}
