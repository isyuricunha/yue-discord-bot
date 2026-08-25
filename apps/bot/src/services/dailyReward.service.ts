import { prisma } from '@yuebot/database'
import {
  DAILY_REWARD_MAX_AMOUNT,
  DAILY_REWARD_MAX_STREAK_BONUS,
  DAILY_REWARD_MAX_STREAK_DAYS,
} from '@yuebot/shared'
import { with_serializable_retry } from '../utils/prisma-transaction'

const COOLDOWN_HOURS = 24
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000

interface GuildConfig {
  enabled: boolean
  rewardAmount: bigint
  streakBonus: bigint
  maxStreakBonus: number
}

interface StreakInfo {
  streakCount: number
  totalClaims: number
  lastClaimDate: Date | null
  canClaim: boolean
  nextClaimAt: Date | null
}

interface ClaimResult {
  success: true
  rewardAmount: bigint
  streakBonus: bigint
  totalReward: bigint
  newStreakCount: number
  newTotalClaims: number
  newBalance: bigint
}

type claim_result = ClaimResult | { success: false; error: 'cooldown' | 'disabled' | 'not_found' }

function normalize_config(config: GuildConfig): GuildConfig {
  return {
    enabled: config.enabled,
    rewardAmount: config.rewardAmount < 0n ? 0n : config.rewardAmount > DAILY_REWARD_MAX_AMOUNT ? DAILY_REWARD_MAX_AMOUNT : config.rewardAmount,
    streakBonus: config.streakBonus < 0n ? 0n : config.streakBonus > DAILY_REWARD_MAX_STREAK_BONUS ? DAILY_REWARD_MAX_STREAK_BONUS : config.streakBonus,
    maxStreakBonus: Math.max(0, Math.min(DAILY_REWARD_MAX_STREAK_DAYS, config.maxStreakBonus)),
  }
}

class DailyRewardService {
  async getGuildConfig(guildId: string): Promise<GuildConfig> {
    const config = await prisma.guildDailyRewardConfig.findUnique({ where: { guildId } })

    return normalize_config(config
      ? {
          enabled: config.enabled,
          rewardAmount: config.rewardAmount,
          streakBonus: config.streakBonus,
          maxStreakBonus: config.maxStreakBonus,
        }
      : {
          enabled: true,
          rewardAmount: 1000n,
          streakBonus: 100n,
          maxStreakBonus: 30,
        })
  }

  async canClaim(userId: string, guildId: string): Promise<{ canClaim: boolean; nextClaimAt: Date | null }> {
    const config = await this.getGuildConfig(guildId)
    if (!config.enabled) return { canClaim: false, nextClaimAt: null }

    const dailyReward = await prisma.userDailyReward.findUnique({ where: { userId } })
    if (!dailyReward) return { canClaim: true, nextClaimAt: null }

    const nextClaimAt = new Date(dailyReward.lastClaimDate.getTime() + COOLDOWN_MS)
    return Date.now() >= nextClaimAt.getTime()
      ? { canClaim: true, nextClaimAt: null }
      : { canClaim: false, nextClaimAt }
  }

  async getStreakInfo(userId: string): Promise<StreakInfo> {
    const dailyReward = await prisma.userDailyReward.findUnique({ where: { userId } })
    if (!dailyReward) {
      return {
        streakCount: 0,
        totalClaims: 0,
        lastClaimDate: null,
        canClaim: true,
        nextClaimAt: null,
      }
    }

    const nextClaimAt = new Date(dailyReward.lastClaimDate.getTime() + COOLDOWN_MS)
    const canClaim = Date.now() >= nextClaimAt.getTime()

    return {
      streakCount: dailyReward.streakCount,
      totalClaims: dailyReward.totalClaims,
      lastClaimDate: dailyReward.lastClaimDate,
      canClaim,
      nextClaimAt: canClaim ? null : nextClaimAt,
    }
  }

  async claimReward(userId: string, guildId: string): Promise<claim_result> {
    const config = await this.getGuildConfig(guildId)
    if (!config.enabled) return { success: false, error: 'disabled' }

    return await with_serializable_retry(async (tx) => {
      const now = new Date()
      const dailyReward = await tx.userDailyReward.findUnique({ where: { userId } })

      if (dailyReward) {
        const nextClaimAt = new Date(dailyReward.lastClaimDate.getTime() + COOLDOWN_MS)
        if (now < nextClaimAt) return { success: false as const, error: 'cooldown' as const }
      }

      let newStreakCount = 1
      if (dailyReward) {
        const hoursSinceLastClaim = (now.getTime() - dailyReward.lastClaimDate.getTime()) / (1000 * 60 * 60)
        if (hoursSinceLastClaim >= COOLDOWN_HOURS - 1 && hoursSinceLastClaim <= COOLDOWN_HOURS + 1) {
          newStreakCount = dailyReward.streakCount + 1
        }
      }

      const streakBonus = BigInt(Math.min(newStreakCount, config.maxStreakBonus)) * config.streakBonus
      const totalReward = config.rewardAmount + streakBonus

      await tx.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } })
      await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId, balance: 0n } })

      const dailyAfter = await tx.userDailyReward.upsert({
        where: { userId },
        update: {
          lastClaimDate: now,
          streakCount: newStreakCount,
          totalClaims: { increment: 1 },
        },
        create: {
          userId,
          lastClaimDate: now,
          streakCount: newStreakCount,
          totalClaims: 1,
        },
        select: { totalClaims: true },
      })

      const wallet = await tx.wallet.update({
        where: { userId },
        data: { balance: { increment: totalReward } },
        select: { balance: true },
      })

      await tx.luazinhaTransaction.create({
        data: {
          type: 'daily_reward',
          amount: totalReward,
          toUserId: userId,
          guildId,
          reason: `Recompensa diária - sequência: ${newStreakCount} dias`,
        },
      })

      return {
        success: true as const,
        rewardAmount: config.rewardAmount,
        streakBonus,
        totalReward,
        newStreakCount,
        newTotalClaims: dailyAfter.totalClaims,
        newBalance: wallet.balance,
      }
    }, { max_attempts: 10 })
  }

  async getGuildConfigOrNull(guildId: string): Promise<GuildConfig | null> {
    const config = await prisma.guildDailyRewardConfig.findUnique({ where: { guildId } })
    if (!config) return null
    return normalize_config({
      enabled: config.enabled,
      rewardAmount: config.rewardAmount,
      streakBonus: config.streakBonus,
      maxStreakBonus: config.maxStreakBonus,
    })
  }

  async updateGuildConfig(
    guildId: string,
    data: { enabled?: boolean; rewardAmount?: bigint; streakBonus?: bigint; maxStreakBonus?: number }
  ): Promise<GuildConfig> {
    const normalized = normalize_config({
      enabled: data.enabled ?? true,
      rewardAmount: data.rewardAmount ?? 1000n,
      streakBonus: data.streakBonus ?? 100n,
      maxStreakBonus: data.maxStreakBonus ?? 30,
    })

    const updated = await prisma.guildDailyRewardConfig.upsert({
      where: { guildId },
      update: {
        ...(data.enabled === undefined ? {} : { enabled: normalized.enabled }),
        ...(data.rewardAmount === undefined ? {} : { rewardAmount: normalized.rewardAmount }),
        ...(data.streakBonus === undefined ? {} : { streakBonus: normalized.streakBonus }),
        ...(data.maxStreakBonus === undefined ? {} : { maxStreakBonus: normalized.maxStreakBonus }),
      },
      create: { guildId, ...normalized },
    })

    return normalize_config({
      enabled: updated.enabled,
      rewardAmount: updated.rewardAmount,
      streakBonus: updated.streakBonus,
      maxStreakBonus: updated.maxStreakBonus,
    })
  }
}

export const dailyRewardService = new DailyRewardService()
