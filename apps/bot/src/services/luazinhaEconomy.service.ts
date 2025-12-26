import { prisma, Prisma } from '@yuebot/database'

export type balance_result = { balance: bigint }

export type transfer_result =
  | { success: true; fromBalance: bigint; toBalance: bigint }
  | { success: false; error: 'invalid_amount' | 'insufficient_funds' | 'same_user' }

export type admin_adjust_result =
  | { success: true; balance: bigint }
  | { success: false; error: 'invalid_amount' | 'insufficient_funds' }

type tx_client = Prisma.TransactionClient

function normalize_amount(input: bigint): bigint {
  if (input < 0n) return 0n
  return input
}

async function with_serializable_retry<T>(fn: (tx: tx_client) => Promise<T>, max_attempts = 5): Promise<T> {
  let attempt = 0
  while (true) {
    attempt += 1

    try {
      return await prisma.$transaction(
        async (tx) => {
          return await fn(tx)
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      const err = error as { code?: unknown; message?: unknown }
      const code = typeof err.code === 'string' ? err.code : ''

      // Postgres serialization failure
      if (code === 'P2034' || code === '40001') {
        if (attempt >= max_attempts) throw error
        continue
      }

      throw error
    }
  }
}

export class LuazinhaEconomyService {
  async get_balance(user_id: string): Promise<balance_result> {
    const wallet = await prisma.wallet.findUnique({ where: { userId: user_id }, select: { balance: true } })
    return { balance: wallet?.balance ?? 0n }
  }

  async ensure_user(user_id: string, input: { username?: string | null; avatar?: string | null }): Promise<void> {
    await prisma.user.upsert({
      where: { id: user_id },
      update: { username: input.username ?? undefined, avatar: input.avatar ?? undefined },
      create: { id: user_id, username: input.username ?? null, avatar: input.avatar ?? null },
    })

    await prisma.wallet.upsert({
      where: { userId: user_id },
      update: {},
      create: { userId: user_id, balance: 0n },
    })
  }

  async transfer(input: {
    from_user_id: string
    to_user_id: string
    amount: bigint
    guild_id?: string | null
    reason?: string | null
  }): Promise<transfer_result> {
    const amount = normalize_amount(input.amount)
    if (amount <= 0n) return { success: false as const, error: 'invalid_amount' }
    if (input.from_user_id === input.to_user_id) return { success: false as const, error: 'same_user' }

    return await with_serializable_retry(async (tx) => {
      const from_wallet = await tx.wallet.upsert({
        where: { userId: input.from_user_id },
        update: {},
        create: { userId: input.from_user_id, balance: 0n },
        select: { balance: true },
      })

      if (from_wallet.balance < amount) {
        return { success: false as const, error: 'insufficient_funds' }
      }

      const to_wallet = await tx.wallet.upsert({
        where: { userId: input.to_user_id },
        update: {},
        create: { userId: input.to_user_id, balance: 0n },
        select: { balance: true },
      })

      const updated_from = await tx.wallet.update({
        where: { userId: input.from_user_id },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      })

      const updated_to = await tx.wallet.update({
        where: { userId: input.to_user_id },
        data: { balance: { increment: amount } },
        select: { balance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'transfer',
          amount,
          fromUserId: input.from_user_id,
          toUserId: input.to_user_id,
          guildId: input.guild_id ?? null,
          reason: input.reason ?? null,
        },
      })

      return { success: true as const, fromBalance: updated_from.balance, toBalance: updated_to.balance }
    })
  }

  async admin_add(input: {
    to_user_id: string
    amount: bigint
    guild_id?: string | null
    reason?: string | null
  }): Promise<admin_adjust_result> {
    const amount = normalize_amount(input.amount)
    if (amount <= 0n) return { success: false as const, error: 'invalid_amount' }

    return await with_serializable_retry(async (tx) => {
      const updated = await tx.wallet.upsert({
        where: { userId: input.to_user_id },
        update: { balance: { increment: amount } },
        create: { userId: input.to_user_id, balance: amount },
        select: { balance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'admin_add',
          amount,
          toUserId: input.to_user_id,
          guildId: input.guild_id ?? null,
          reason: input.reason ?? null,
        },
      })

      return { success: true as const, balance: updated.balance }
    })
  }

  async admin_remove(input: {
    from_user_id: string
    amount: bigint
    guild_id?: string | null
    reason?: string | null
  }): Promise<admin_adjust_result> {
    const amount = normalize_amount(input.amount)
    if (amount <= 0n) return { success: false, error: 'invalid_amount' }

    return await with_serializable_retry(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: input.from_user_id },
        update: {},
        create: { userId: input.from_user_id, balance: 0n },
        select: { balance: true },
      })

      if (wallet.balance < amount) {
        return { success: false as const, error: 'insufficient_funds' }
      }

      const updated = await tx.wallet.update({
        where: { userId: input.from_user_id },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'admin_remove',
          amount,
          fromUserId: input.from_user_id,
          guildId: input.guild_id ?? null,
          reason: input.reason ?? null,
        },
      })

      return { success: true as const, balance: updated.balance }
    })
  }
}

export const luazinhaEconomyService = new LuazinhaEconomyService()
