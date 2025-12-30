import type { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@yuebot/database'
import { coinflipActionSchema, coinflipCreateBetSchema } from '@yuebot/shared'

import { validation_error_details } from '../utils/validation_error'

type coin_side = 'heads' | 'tails'

type tx_client = Prisma.TransactionClient

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

function normalize_amount(input: bigint): bigint {
  if (input < 0n) return 0n
  return input
}

function pick_result_side(): coin_side {
  const r = Math.random() < 0.5 ? 'heads' : 'tails'
  return r as coin_side
}

function serialize_game(game: {
  id: string
  status: string
  guildId: string | null
  channelId: string | null
  messageId: string | null
  challengerId: string
  opponentId: string
  betAmount: bigint
  challengerSide: string
  winnerId: string | null
  resultSide: string | null
  createdAt: Date
  resolvedAt: Date | null
  challenger?: { id: string; username: string | null; avatar: string | null } | null
  opponent?: { id: string; username: string | null; avatar: string | null } | null
  winner?: { id: string; username: string | null; avatar: string | null } | null
}) {
  return {
    ...game,
    betAmount: game.betAmount.toString(),
  }
}

export async function coinflipRoutes(fastify: FastifyInstance) {
  fastify.get('/coinflip/stats/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user

    const played = await prisma.coinflipGame.count({
      where: {
        status: 'completed',
        OR: [{ challengerId: user.userId }, { opponentId: user.userId }],
      },
    })

    const wins = await prisma.coinflipGame.count({ where: { status: 'completed', winnerId: user.userId } })
    const losses = Math.max(0, played - wins)

    const wins_sum = await prisma.coinflipGame.aggregate({
      where: { status: 'completed', winnerId: user.userId },
      _sum: { betAmount: true },
    })

    const losses_sum = await prisma.coinflipGame.aggregate({
      where: {
        status: 'completed',
        winnerId: { not: user.userId },
        OR: [{ challengerId: user.userId }, { opponentId: user.userId }],
      },
      _sum: { betAmount: true },
    })

    const won = wins_sum._sum.betAmount ?? 0n
    const lost = losses_sum._sum.betAmount ?? 0n

    return {
      played,
      wins,
      losses,
      won: won.toString(),
      lost: lost.toString(),
      net: (won - lost).toString(),
    }
  })

  fastify.get('/coinflip/games', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user
    const { limit = 50, offset = 0, status } = request.query as {
      limit?: number
      offset?: number
      status?: 'pending' | 'declined' | 'completed'
    }

    const take = Math.min(Math.max(Number(limit), 1), 200)
    const skip = Math.max(Number(offset), 0)

    const where = {
      ...(status ? { status } : {}),
      OR: [{ challengerId: user.userId }, { opponentId: user.userId }],
    } satisfies Prisma.CoinflipGameWhereInput

    const [rows, total] = await Promise.all([
      prisma.coinflipGame.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          challenger: { select: { id: true, username: true, avatar: true } },
          opponent: { select: { id: true, username: true, avatar: true } },
          winner: { select: { id: true, username: true, avatar: true } },
        },
      }),
      prisma.coinflipGame.count({ where }),
    ])

    return { games: rows.map((g) => serialize_game(g)), total }
  })

  fastify.post('/coinflip/bet', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = coinflipCreateBetSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const user = request.user
    const input = parsed.data

    if (input.opponentId === user.userId) {
      return reply.code(400).send({ error: 'Invalid body', details: 'Cannot bet against self' })
    }

    const amount = normalize_amount(input.betAmount)
    if (amount <= 0n) {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    const game = await prisma.coinflipGame.create({
      data: {
        status: 'pending',
        guildId: input.guildId ?? null,
        channelId: null,
        messageId: null,
        challengerId: user.userId,
        opponentId: input.opponentId,
        betAmount: amount,
        challengerSide: input.challengerSide,
      },
      include: {
        challenger: { select: { id: true, username: true, avatar: true } },
        opponent: { select: { id: true, username: true, avatar: true } },
      },
    })

    return reply.send({ game: serialize_game(game) })
  })

  fastify.post('/coinflip/decline', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = coinflipActionSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const user = request.user

    const updated = await with_serializable_retry(async (tx) => {
      const game = await tx.coinflipGame.findUnique({ where: { id: parsed.data.gameId } })
      if (!game) return { ok: false as const, error: 'not_found' }
      if (game.status !== 'pending') return { ok: false as const, error: 'already_resolved' }
      if (game.opponentId !== user.userId) return { ok: false as const, error: 'not_opponent' }

      const next = await tx.coinflipGame.update({
        where: { id: game.id },
        data: { status: 'declined', resolvedAt: new Date() },
      })

      return { ok: true as const, game: next }
    })

    if (!updated.ok) {
      const msg =
        updated.error === 'not_found'
          ? 'Bet not found'
          : updated.error === 'already_resolved'
            ? 'Bet already resolved'
            : 'Forbidden'
      return reply.code(updated.error === 'not_opponent' ? 403 : 404).send({ error: msg })
    }

    return reply.send({ success: true, game: serialize_game(updated.game) })
  })

  fastify.post('/coinflip/accept', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = coinflipActionSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const user = request.user

    const result = await with_serializable_retry(async (tx) => {
      const game = await tx.coinflipGame.findUnique({ where: { id: parsed.data.gameId } })
      if (!game) return { ok: false as const, error: 'not_found' }
      if (game.status !== 'pending') return { ok: false as const, error: 'already_resolved' }
      if (game.opponentId !== user.userId) return { ok: false as const, error: 'not_opponent' }

      await tx.user.upsert({ where: { id: game.challengerId }, update: {}, create: { id: game.challengerId } })
      await tx.user.upsert({ where: { id: game.opponentId }, update: {}, create: { id: game.opponentId } })

      await tx.wallet.upsert({ where: { userId: game.challengerId }, update: {}, create: { userId: game.challengerId, balance: 0n } })
      await tx.wallet.upsert({ where: { userId: game.opponentId }, update: {}, create: { userId: game.opponentId, balance: 0n } })

      const challenger_wallet = await tx.wallet.findUnique({ where: { userId: game.challengerId }, select: { balance: true } })
      const opponent_wallet = await tx.wallet.findUnique({ where: { userId: game.opponentId }, select: { balance: true } })

      const bet = game.betAmount

      if ((challenger_wallet?.balance ?? 0n) < bet || (opponent_wallet?.balance ?? 0n) < bet) {
        return { ok: false as const, error: 'insufficient_funds' }
      }

      const resultSide = pick_result_side()
      const challenger_wins = resultSide === (game.challengerSide as coin_side)
      const winner_id = challenger_wins ? game.challengerId : game.opponentId
      const loser_id = challenger_wins ? game.opponentId : game.challengerId

      await tx.wallet.update({ where: { userId: game.challengerId }, data: { balance: { decrement: bet } } })
      await tx.wallet.update({ where: { userId: game.opponentId }, data: { balance: { decrement: bet } } })
      await tx.wallet.update({ where: { userId: winner_id }, data: { balance: { increment: bet * 2n } } })

      const winner_wallet = await tx.wallet.findUnique({ where: { userId: winner_id }, select: { balance: true } })
      const loser_wallet = await tx.wallet.findUnique({ where: { userId: loser_id }, select: { balance: true } })

      await tx.luazinhaTransaction.createMany({
        data: [
          {
            type: 'coinflip_bet',
            amount: bet,
            fromUserId: game.challengerId,
            guildId: game.guildId,
            metadata: { gameId: game.id, role: 'challenger' },
          },
          {
            type: 'coinflip_bet',
            amount: bet,
            fromUserId: game.opponentId,
            guildId: game.guildId,
            metadata: { gameId: game.id, role: 'opponent' },
          },
          {
            type: 'coinflip_payout',
            amount: bet * 2n,
            toUserId: winner_id,
            guildId: game.guildId,
            metadata: { gameId: game.id },
          },
        ],
      })

      const updated_game = await tx.coinflipGame.update({
        where: { id: game.id },
        data: {
          status: 'completed',
          winnerId: winner_id,
          resultSide,
          resolvedAt: new Date(),
        },
        include: {
          challenger: { select: { id: true, username: true, avatar: true } },
          opponent: { select: { id: true, username: true, avatar: true } },
          winner: { select: { id: true, username: true, avatar: true } },
        },
      })

      return {
        ok: true as const,
        game: updated_game,
        resultSide,
        winnerId: winner_id,
        loserId: loser_id,
        betAmount: bet,
        winnerBalance: winner_wallet?.balance ?? 0n,
        loserBalance: loser_wallet?.balance ?? 0n,
      }
    })

    if (!result.ok) {
      const status =
        result.error === 'not_opponent' ? 403 : result.error === 'not_found' ? 404 : 400
      const msg =
        result.error === 'not_found'
          ? 'Bet not found'
          : result.error === 'already_resolved'
            ? 'Bet already resolved'
            : result.error === 'insufficient_funds'
              ? 'Insufficient funds'
              : 'Forbidden'
      return reply.code(status).send({ error: msg })
    }

    return reply.send({
      success: true,
      resultSide: result.resultSide,
      winnerId: result.winnerId,
      loserId: result.loserId,
      betAmount: result.betAmount.toString(),
      winnerBalance: result.winnerBalance.toString(),
      loserBalance: result.loserBalance.toString(),
      game: serialize_game(result.game),
    })
  })
}
