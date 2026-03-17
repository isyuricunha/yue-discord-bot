import { prisma, Prisma } from '@yuebot/database'

const COOLDOWN_HOURS = 24
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000

type tx_client = Prisma.TransactionClient

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

class DailyRewardService {
  async getGuildConfig(guildId: string): Promise<GuildConfig> {
    const config = await prisma.guildDailyRewardConfig.findUnique({
      where: { guildId },
    })

    if (!config) {
      return {
        enabled: true,
        rewardAmount: 1000n,
        streakBonus: 100n,
        maxStreakBonus: 30,
      }
    }

    return {
      enabled: config.enabled,
      rewardAmount: config.rewardAmount,
      streakBonus: config.streakBonus,
      maxStreakBonus: config.maxStreakBonus,
    }
  }

  async canClaim(userId: string, guildId: string): Promise<{ canClaim: boolean; nextClaimAt: Date | null }> {
    const config = await this.getGuildConfig(guildId)
    if (!config.enabled) {
      return { canClaim: false, nextClaimAt: null }
    }

    const dailyReward = await prisma.userDailyReward.findUnique({
      where: { userId },
    })

    if (!dailyReward) {
      return { canClaim: true, nextClaimAt: null }
    }

    const now = new Date()
    const lastClaim = new Date(dailyReward.lastClaimDate)
    const nextClaimAt = new Date(lastClaim.getTime() + COOLDOWN_MS)

    if (now >= nextClaimAt) {
      return { canClaim: true, nextClaimAt: null }
    }

    return { canClaim: false, nextClaimAt }
  }

  async getStreakInfo(userId: string): Promise<StreakInfo> {
    const dailyReward = await prisma.userDailyReward.findUnique({
      where: { userId },
    })

    if (!dailyReward) {
      return {
        streakCount: 0,
        totalClaims: 0,
        lastClaimDate: null,
        canClaim: true,
        nextClaimAt: null,
      }
    }

    const now = new Date()
    const lastClaim = new Date(dailyReward.lastClaimDate)
    const nextClaimAt = new Date(lastClaim.getTime() + COOLDOWN_MS)
    const canClaim = now >= nextClaimAt

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
    if (!config.enabled) {
      return { success: false, error: 'disabled' }
    }

    const { canClaim: canClaimNow, nextClaimAt } = await this.canClaim(userId, guildId)
    if (!canClaimNow) {
      return { success: false, error: 'cooldown' }
    }

    const dailyReward = await prisma.userDailyReward.findUnique({
      where: { userId },
    })

    const now = new Date()
    let newStreakCount = 1

    if (dailyReward) {
      const lastClaim = new Date(dailyReward.lastClaimDate)
      const hoursSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastClaim >= COOLDOWN_HOURS - 1 && hoursSinceLastClaim <= COOLDOWN_HOURS + 1) {
        newStreakCount = dailyReward.streakCount + 1
      } else if (hoursSinceLastClaim > COOLDOWN_HOURS + 1) {
        newStreakCount = 1
      }
    }

    const streakBonus = BigInt(Math.min(newStreakCount, config.maxStreakBonus)) * config.streakBonus
    const totalReward = config.rewardAmount + streakBonus

    await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
      })

      await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0n },
      })

      await tx.userDailyReward.upsert({
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

      return wallet
    })

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    })

    const dailyRewardAfter = await prisma.userDailyReward.findUnique({
      where: { userId },
      select: { totalClaims: true },
    })

    return {
      success: true,
      rewardAmount: config.rewardAmount,
      streakBonus,
      totalReward,
      newStreakCount,
      newTotalClaims: dailyRewardAfter?.totalClaims ?? 0,
      newBalance: wallet?.balance ?? 0n,
    }
  }

  async getGuildConfigOrNull(guildId: string): Promise<GuildConfig | null> {
    const config = await prisma.guildDailyRewardConfig.findUnique({
      where: { guildId },
    })

    if (!config) {
      return null
    }

    return {
      enabled: config.enabled,
      rewardAmount: config.rewardAmount,
      streakBonus: config.streakBonus,
      maxStreakBonus: config.maxStreakBonus,
    }
  }

  async updateGuildConfig(
    guildId: string,
    data: {
      enabled?: boolean
      rewardAmount?: bigint
      streakBonus?: bigint
      maxStreakBonus?: number
    }
  ): Promise<GuildConfig> {
    const updated = await prisma.guildDailyRewardConfig.upsert({
      where: { guildId },
      update: data,
      create: {
        guildId,
        enabled: data.enabled ?? true,
        rewardAmount: data.rewardAmount ?? 1000n,
        streakBonus: data.streakBonus ?? 100n,
        maxStreakBonus: data.maxStreakBonus ?? 30,
      },
    })

    return {
      enabled: updated.enabled,
      rewardAmount: updated.rewardAmount,
      streakBonus: updated.streakBonus,
      maxStreakBonus: updated.maxStreakBonus,
    }
  }
}

export const dailyRewardService = new DailyRewardService()
