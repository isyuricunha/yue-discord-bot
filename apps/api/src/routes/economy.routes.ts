import type { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@yuebot/database'
import { economyAdminAdjustSchema, economyTransferSchema } from '@yuebot/shared'

import { validation_error_details } from '../utils/validation_error'

function is_owner(fastify: FastifyInstance, user_id: string): boolean {
  const allowlist = fastify.config?.admin?.ownerUserIds as string[] | undefined
  if (!allowlist) return false
  return allowlist.includes(user_id)
}

function get_owner_forbidden_error(fastify: FastifyInstance, viewer_is_owner: boolean) {
  const allowlist = fastify.config?.admin?.ownerUserIds as string[] | undefined
  if (viewer_is_owner && (!allowlist || allowlist.length === 0)) {
    return { error: 'Forbidden', details: 'Owner allowlist is not configured. Set OWNER_USER_IDS in the API environment.' }
  }
  return { error: 'Forbidden' }
}

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
      return await prisma.$transaction(async (tx) => await fn(tx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      const err = error as { code?: unknown }
      const code = typeof err.code === 'string' ? err.code : ''

      if (code === 'P2034' || code === '40001') {
        if (attempt >= max_attempts) throw error
        continue
      }

      throw error
    }
  }
}

export async function economyRoutes(fastify: FastifyInstance) {
  fastify.get('/economy/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.userId }, select: { balance: true } })
    return { success: true, balance: (wallet?.balance ?? 0n).toString() }
  })

  fastify.get('/economy/transactions', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number }

    const take = Math.min(Math.max(Number(limit), 1), 200)
    const skip = Math.max(Number(offset), 0)

    const where = {
      OR: [{ fromUserId: user.userId }, { toUserId: user.userId }],
    } satisfies Prisma.LuazinhaTransactionWhereInput

    const [rows, total] = await Promise.all([
      prisma.luazinhaTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.luazinhaTransaction.count({ where }),
    ])

    return {
      success: true,
      transactions: rows.map((tx) => ({
        ...tx,
        amount: tx.amount.toString(),
      })),
      total,
    }
  })

  fastify.post('/economy/transfer', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = economyTransferSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const user = request.user
    const input = parsed.data

    if (input.toUserId === user.userId) {
      return reply.code(400).send({ error: 'Invalid body', details: 'Cannot transfer to self' })
    }

    const amount = normalize_amount(input.amount)
    if (amount <= 0n) {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    const res = await with_serializable_retry(async (tx) => {
      await tx.user.upsert({ where: { id: user.userId }, update: {}, create: { id: user.userId } })
      await tx.user.upsert({ where: { id: input.toUserId }, update: {}, create: { id: input.toUserId } })

      const from_wallet = await tx.wallet.upsert({
        where: { userId: user.userId },
        update: {},
        create: { userId: user.userId, balance: 0n },
        select: { balance: true },
      })

      if (from_wallet.balance < amount) {
        return { success: false as const, error: 'insufficient_funds' }
      }

      await tx.wallet.upsert({
        where: { userId: input.toUserId },
        update: {},
        create: { userId: input.toUserId, balance: 0n },
      })

      const updated_from = await tx.wallet.update({
        where: { userId: user.userId },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      })

      const updated_to = await tx.wallet.update({
        where: { userId: input.toUserId },
        data: { balance: { increment: amount } },
        select: { balance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'transfer',
          amount,
          fromUserId: user.userId,
          toUserId: input.toUserId,
          guildId: input.guildId ?? null,
          reason: input.reason ?? null,
        },
      })

      return { success: true as const, fromBalance: updated_from.balance, toBalance: updated_to.balance }
    })

    if (!res.success) {
      return reply.code(400).send({ error: 'Insufficient funds' })
    }

    return reply.send({ success: true, fromBalance: res.fromBalance.toString(), toBalance: res.toBalance.toString() })
  })

  fastify.post('/economy/admin/add', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user

    const allowlisted = is_owner(fastify, user.userId)
    if (!allowlisted) {
      return reply.code(403).send(get_owner_forbidden_error(fastify, user.isOwner))
    }

    const parsed = economyAdminAdjustSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const amount = normalize_amount(input.amount)

    const res = await with_serializable_retry(async (tx) => {
      await tx.user.upsert({ where: { id: input.userId }, update: {}, create: { id: input.userId } })

      const updated = await tx.wallet.upsert({
        where: { userId: input.userId },
        update: { balance: { increment: amount } },
        create: { userId: input.userId, balance: amount },
        select: { balance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'admin_add',
          amount,
          toUserId: input.userId,
          guildId: input.guildId ?? null,
          reason: input.reason ?? null,
        },
      })

      return updated.balance
    })

    return reply.send({ success: true, balance: res.toString() })
  })

  fastify.post('/economy/admin/remove', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user

    const allowlisted = is_owner(fastify, user.userId)
    if (!allowlisted) {
      return reply.code(403).send(get_owner_forbidden_error(fastify, user.isOwner))
    }

    const parsed = economyAdminAdjustSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const amount = normalize_amount(input.amount)

    const res = await with_serializable_retry(async (tx) => {
      await tx.user.upsert({ where: { id: input.userId }, update: {}, create: { id: input.userId } })

      const wallet = await tx.wallet.upsert({
        where: { userId: input.userId },
        update: {},
        create: { userId: input.userId, balance: 0n },
        select: { balance: true },
      })

      if (wallet.balance < amount) {
        return { success: false as const }
      }

      const updated = await tx.wallet.update({
        where: { userId: input.userId },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'admin_remove',
          amount,
          fromUserId: input.userId,
          guildId: input.guildId ?? null,
          reason: input.reason ?? null,
        },
      })

      return { success: true as const, balance: updated.balance }
    })

    if (!res.success) {
      return reply.code(400).send({ error: 'Insufficient funds' })
    }

    return reply.send({ success: true, balance: res.balance.toString() })
  })
}
