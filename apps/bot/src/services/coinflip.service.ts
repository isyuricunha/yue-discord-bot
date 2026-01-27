import crypto from 'node:crypto'

import { prisma, Prisma } from '@yuebot/database'
import {
  compute_coinflip_result_side,
  compute_server_seed_hash,
  generate_server_seed_hex,
} from '@yuebot/shared'

import { luazinhaEconomyService } from './luazinhaEconomy.service'

export type coin_side = 'heads' | 'tails'

type tx_client = Prisma.TransactionClient

function random_side(): coin_side {
  return crypto.randomInt(0, 2) === 0 ? 'heads' : 'tails'
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

      // Postgres serialization failure
      if (code === 'P2034' || code === '40001') {
        if (attempt >= max_attempts) throw error
        continue
      }

      throw error
    }
  }
}

export type create_bet_result = { gameId: string; serverSeedHash: string }

export type accept_bet_result =
  | {
      success: true
      resultSide: coin_side
      winnerId: string
      loserId: string
      betAmount: bigint
      winnerBalance: bigint
      loserBalance: bigint
      serverSeed: string | null
      serverSeedHash: string | null
    }
  | { success: false; error: 'not_found' | 'already_resolved' | 'not_opponent' | 'insufficient_funds' }

export type decline_bet_result =
  | { success: true }
  | { success: false; error: 'not_found' | 'already_resolved' | 'not_opponent' }

export class CoinflipService {
  async create_bet(input: {
    guildId: string | null
    channelId: string | null
    messageId: string | null
    challengerId: string
    opponentId: string
    betAmount: bigint
    challengerSide: coin_side
  }): Promise<create_bet_result> {
    const serverSeed = generate_server_seed_hex()
    const serverSeedHash = await compute_server_seed_hash(serverSeed)

    const game = await prisma.coinflipGame.create({
      data: {
        guildId: input.guildId,
        channelId: input.channelId,
        messageId: input.messageId,
        challengerId: input.challengerId,
        opponentId: input.opponentId,
        betAmount: input.betAmount,
        challengerSide: input.challengerSide,
        serverSeed,
        serverSeedHash,
      },
      select: { id: true, serverSeedHash: true },
    })

    return { gameId: game.id, serverSeedHash: game.serverSeedHash ?? serverSeedHash }
  }

  async decline_bet(input: { gameId: string; userId: string }): Promise<decline_bet_result> {
    return await with_serializable_retry(async (tx) => {
      const game = await tx.coinflipGame.findUnique({ where: { id: input.gameId } })
      if (!game) return { success: false as const, error: 'not_found' }
      if (game.status !== 'pending') return { success: false as const, error: 'already_resolved' }
      if (game.opponentId !== input.userId) return { success: false as const, error: 'not_opponent' }

      await tx.coinflipGame.update({
        where: { id: input.gameId },
        data: { status: 'declined', resolvedAt: new Date() },
      })

      return { success: true as const }
    })
  }

  async accept_bet(input: { gameId: string; userId: string }): Promise<accept_bet_result> {
    return await with_serializable_retry(async (tx) => {
      const game = await tx.coinflipGame.findUnique({ where: { id: input.gameId } })
      if (!game) return { success: false as const, error: 'not_found' }
      if (game.status !== 'pending') return { success: false as const, error: 'already_resolved' }
      if (game.opponentId !== input.userId) return { success: false as const, error: 'not_opponent' }

      // Ensure wallets exist
      await tx.wallet.upsert({ where: { userId: game.challengerId }, update: {}, create: { userId: game.challengerId, balance: 0n } })
      await tx.wallet.upsert({ where: { userId: game.opponentId }, update: {}, create: { userId: game.opponentId, balance: 0n } })

      const challenger_wallet = await tx.wallet.findUnique({ where: { userId: game.challengerId }, select: { balance: true } })
      const opponent_wallet = await tx.wallet.findUnique({ where: { userId: game.opponentId }, select: { balance: true } })

      const bet = game.betAmount

      if ((challenger_wallet?.balance ?? 0n) < bet || (opponent_wallet?.balance ?? 0n) < bet) {
        return { success: false as const, error: 'insufficient_funds' }
      }

      const has_fairness_commit = typeof game.serverSeed === 'string' && typeof game.serverSeedHash === 'string'

      const resultSide = has_fairness_commit
        ? await compute_coinflip_result_side({ serverSeed: game.serverSeed!, gameId: game.id })
        : random_side()

      const challenger_wins = resultSide === game.challengerSide
      const winner_id = challenger_wins ? game.challengerId : game.opponentId
      const loser_id = challenger_wins ? game.opponentId : game.challengerId

      // debit both
      await tx.wallet.update({ where: { userId: game.challengerId }, data: { balance: { decrement: bet } } })
      await tx.wallet.update({ where: { userId: game.opponentId }, data: { balance: { decrement: bet } } })

      // payout winner 2x
      await tx.wallet.update({ where: { userId: winner_id }, data: { balance: { increment: bet * 2n } } })

      const winner_wallet = await tx.wallet.findUnique({ where: { userId: winner_id }, select: { balance: true } })
      const loser_wallet = await tx.wallet.findUnique({ where: { userId: loser_id }, select: { balance: true } })

      // ledger
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
          ...(game.serverSeed && !game.serverSeedHash ? { serverSeedHash: await compute_server_seed_hash(game.serverSeed) } : {}),
        },
        select: { serverSeed: true, serverSeedHash: true },
      })

      return {
        success: true as const,
        resultSide,
        winnerId: winner_id,
        loserId: loser_id,
        betAmount: bet,
        winnerBalance: winner_wallet?.balance ?? 0n,
        loserBalance: loser_wallet?.balance ?? 0n,
        serverSeed: updated_game.serverSeed ?? null,
        serverSeedHash: updated_game.serverSeedHash ?? null,
      }
    })
  }

  async ensure_users_for_game(gameId: string): Promise<void> {
    const game = await prisma.coinflipGame.findUnique({ where: { id: gameId } })
    if (!game) return

    // Ensure users and wallets exist. Names are best-effort; bot can refresh later.
    await luazinhaEconomyService.ensure_user(game.challengerId, { username: null, avatar: null })
    await luazinhaEconomyService.ensure_user(game.opponentId, { username: null, avatar: null })
  }
}

export const coinflipService = new CoinflipService()
