import { prisma, Prisma } from '@yuebot/database'
import { BANK } from '@yuebot/shared'

type balance_result = { balance: bigint }

type bank_balance_result = { bankBalance: bigint; totalInterestEarned: bigint; lastInterestAt: Date | null }

type transfer_result =
  | { success: true; fromBalance: bigint; toBalance: bigint }
  | { success: false; error: 'invalid_amount' | 'insufficient_funds' | 'same_user' }

type deposit_result =
  | { success: true; walletBalance: bigint; bankBalance: bigint }
  | { success: false; error: 'invalid_amount' | 'insufficient_funds' }

type withdraw_result =
  | { success: true; walletBalance: bigint; bankBalance: bigint }
  | { success: false; error: 'invalid_amount' | 'insufficient_funds' }

type admin_adjust_result =
  | { success: true; balance: bigint }
  | { success: false; error: 'invalid_amount' | 'insufficient_funds' }

type deduct_tax_result =
  | { success: true; newBalance: bigint }
  | { success: false; error: 'insufficient_funds' | 'invalid_amount' }

type accrue_interest_result =
  | { success: true; interestEarned: bigint; newBankBalance: bigint; newTotalInterest: bigint }
  | { success: false; error: 'no_balance' | 'too_soon' }

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

class LuazinhaEconomyService {
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

      await tx.wallet.upsert({
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

  async deduct_tax(input: { user_id: string; amount: bigint; guild_id?: string | null; reason?: string | null }): Promise<deduct_tax_result> {
    const amount = normalize_amount(input.amount)
    if (amount <= 0n) return { success: false as const, error: 'invalid_amount' }

    return await with_serializable_retry(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: input.user_id },
        update: {},
        create: { userId: input.user_id, balance: 0n },
        select: { balance: true },
      })

      if (wallet.balance < amount) {
        return { success: false as const, error: 'insufficient_funds' }
      }

      const updated = await tx.wallet.update({
        where: { userId: input.user_id },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'tax',
          amount,
          fromUserId: input.user_id,
          guildId: input.guild_id ?? null,
          reason: input.reason ?? null,
        },
      })

      return { success: true as const, newBalance: updated.balance }
    })
  }

  // Bank functions
  async get_bank_balance(user_id: string): Promise<bank_balance_result> {
    const wallet = await prisma.wallet.findUnique({ where: { userId: user_id } })
    return {
      bankBalance: wallet?.bankBalance ?? 0n,
      totalInterestEarned: wallet?.totalInterestEarned ?? 0n,
      lastInterestAt: wallet?.lastInterestAt ?? null,
    }
  }

  async get_full_balance(user_id: string): Promise<{ balance: bigint; bankBalance: bigint; totalInterestEarned: bigint }> {
    const wallet = await prisma.wallet.findUnique({ where: { userId: user_id } })
    return {
      balance: wallet?.balance ?? 0n,
      bankBalance: wallet?.bankBalance ?? 0n,
      totalInterestEarned: wallet?.totalInterestEarned ?? 0n,
    }
  }

  async deposit(input: { user_id: string; amount: bigint; guild_id?: string | null }): Promise<deposit_result> {
    const amount = normalize_amount(input.amount)
    if (amount <= 0n) return { success: false as const, error: 'invalid_amount' }

    return await with_serializable_retry(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: input.user_id },
        update: {},
        create: { userId: input.user_id, balance: 0n, bankBalance: 0n, lastInterestAt: new Date(), totalInterestEarned: 0n },
        select: { balance: true, bankBalance: true },
      })

      if (wallet.balance < amount) {
        return { success: false as const, error: 'insufficient_funds' }
      }

      const updated = await tx.wallet.update({
        where: { userId: input.user_id },
        data: {
          balance: { decrement: amount },
          bankBalance: { increment: amount },
        },
        select: { balance: true, bankBalance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'deposit',
          amount,
          fromUserId: input.user_id,
          toUserId: input.user_id,
          guildId: input.guild_id ?? null,
          reason: 'Depósito no banco',
        },
      })

      return { success: true as const, walletBalance: updated.balance, bankBalance: updated.bankBalance }
    })
  }

  async withdraw(input: { user_id: string; amount: bigint; guild_id?: string | null }): Promise<withdraw_result> {
    const amount = normalize_amount(input.amount)
    if (amount <= 0n) return { success: false as const, error: 'invalid_amount' }

    return await with_serializable_retry(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: input.user_id },
        update: {},
        create: { userId: input.user_id, balance: 0n, bankBalance: 0n, lastInterestAt: new Date(), totalInterestEarned: 0n },
        select: { balance: true, bankBalance: true },
      })

      if (wallet.bankBalance < amount) {
        return { success: false as const, error: 'insufficient_funds' }
      }

      const updated = await tx.wallet.update({
        where: { userId: input.user_id },
        data: {
          balance: { increment: amount },
          bankBalance: { decrement: amount },
        },
        select: { balance: true, bankBalance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'withdraw',
          amount,
          fromUserId: input.user_id,
          toUserId: input.user_id,
          guildId: input.guild_id ?? null,
          reason: 'Saque do banco',
        },
      })

      return { success: true as const, walletBalance: updated.balance, bankBalance: updated.bankBalance }
    })
  }

  async accrue_interest(user_id: string): Promise<accrue_interest_result> {
    const interestRate = BANK.DEFAULT_INTEREST_RATE
    const minBalance = BANK.MINIMUM_BALANCE_FOR_INTEREST
    const intervalMs = BANK.INTEREST_INTERVAL_HOURS * 60 * 60 * 1000

    return await with_serializable_retry(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: user_id } })

      if (!wallet || wallet.bankBalance < minBalance) {
        return { success: false as const, error: 'no_balance' }
      }

      const now = new Date()
      const lastInterest = wallet.lastInterestAt ?? new Date(0)
      const timeSinceLastInterest = now.getTime() - lastInterest.getTime()

      if (timeSinceLastInterest < intervalMs) {
        return { success: false as const, error: 'too_soon' }
      }

      // Calculate interest: bankBalance * interestRate (as decimal)
      // Use integer math: (bankBalance * rate * 100) / 100 to avoid floating point
      const interestRatePercent = Math.round(interestRate * 100)
      const interestEarned = (wallet.bankBalance * BigInt(interestRatePercent)) / 100n

      if (interestEarned <= 0n) {
        return { success: false as const, error: 'no_balance' }
      }

      const updated = await tx.wallet.update({
        where: { userId: user_id },
        data: {
          bankBalance: { increment: interestEarned },
          totalInterestEarned: { increment: interestEarned },
          lastInterestAt: now,
        },
        select: { bankBalance: true, totalInterestEarned: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'interest',
          amount: interestEarned,
          toUserId: user_id,
          reason: 'Juros do banco',
        },
      })

      return {
        success: true as const,
        interestEarned,
        newBankBalance: updated.bankBalance,
        newTotalInterest: updated.totalInterestEarned,
      }
    })
  }

  async accrue_all_interests(): Promise<number> {
    const wallets = await prisma.wallet.findMany({
      where: {
        bankBalance: { gte: BANK.MINIMUM_BALANCE_FOR_INTEREST },
      },
      select: { userId: true },
    })

    let processed = 0
    for (const wallet of wallets) {
      const result = await this.accrue_interest(wallet.userId)
      if (result.success) {
        processed++
      }
    }

    return processed
  }
}

export const luazinhaEconomyService = new LuazinhaEconomyService()
