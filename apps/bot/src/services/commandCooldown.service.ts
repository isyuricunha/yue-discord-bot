import { prisma } from '@yuebot/database'
import { DEFAULT_COMMAND_COOLDOWNS } from '@yuebot/shared'
import { BoundedTtlCache } from '../utils/bounded_ttl_cache'
import { logger } from '../utils/logger'
import { with_serializable_retry } from '../utils/prisma-transaction'
import { safe_error_details } from '../utils/safe_error'

const CACHE_TTL_MS = 60_000
const cooldown_cache = new BoundedTtlCache<string, number>({ ttl_ms: CACHE_TTL_MS, max_entries: 5000 })

function cooldown_cache_key(guild_id: string, command_name: string) {
  return `${guild_id}:${command_name}`
}

type cooldown_reservation = {
  onCooldown: boolean
  remainingSeconds: number
  reservationUsedAt: Date | null
}

export const commandCooldownService = {
  async getCooldown(guild_id: string, command_name: string): Promise<number> {
    const key = cooldown_cache_key(guild_id, command_name)
    const cached = cooldown_cache.get(key)
    if (cached !== undefined) return cached

    try {
      const dbCooldown = await prisma.guildCommandCooldown.findUnique({
        where: { guildId_commandName: { guildId: guild_id, commandName: command_name } },
        select: { cooldownSeconds: true },
      })
      const cooldown = dbCooldown?.cooldownSeconds ?? DEFAULT_COMMAND_COOLDOWNS[command_name] ?? 0
      cooldown_cache.set(key, cooldown)
      return cooldown
    } catch (error) {
      logger.error({ err: safe_error_details(error), guild_id, command_name }, 'Erro ao buscar cooldown de comando')
      return DEFAULT_COMMAND_COOLDOWNS[command_name] ?? 0
    }
  },

  async consumeCooldown(guild_id: string, user_id: string, command_name: string): Promise<cooldown_reservation> {
    const cooldown_seconds = await this.getCooldown(guild_id, command_name)
    if (cooldown_seconds <= 0) {
      return { onCooldown: false, remainingSeconds: 0, reservationUsedAt: null }
    }

    try {
      return await with_serializable_retry(async (tx) => {
        const now = new Date()
        const current = await tx.userCommandCooldown.findUnique({
          where: {
            guildId_userId_commandName: {
              guildId: guild_id,
              userId: user_id,
              commandName: command_name,
            },
          },
          select: { usedAt: true },
        })

        if (current) {
          const remaining_ms = cooldown_seconds * 1000 - (now.getTime() - current.usedAt.getTime())
          if (remaining_ms > 0) {
            return {
              onCooldown: true as const,
              remainingSeconds: Math.ceil(remaining_ms / 1000),
              reservationUsedAt: null,
            }
          }
        }

        await tx.userCommandCooldown.upsert({
          where: {
            guildId_userId_commandName: {
              guildId: guild_id,
              userId: user_id,
              commandName: command_name,
            },
          },
          update: { usedAt: now },
          create: { guildId: guild_id, userId: user_id, commandName: command_name, usedAt: now },
        })

        return { onCooldown: false as const, remainingSeconds: 0, reservationUsedAt: now }
      }, { max_attempts: 10 })
    } catch (error) {
      logger.error({ err: safe_error_details(error), guild_id, user_id, command_name }, 'Erro ao reservar cooldown de comando')
      // Preserve the existing fail-open behavior if cooldown storage is unavailable.
      return { onCooldown: false, remainingSeconds: 0, reservationUsedAt: null }
    }
  },

  async releaseCooldown(guild_id: string, user_id: string, command_name: string, reservation_used_at: Date): Promise<void> {
    try {
      await prisma.userCommandCooldown.deleteMany({
        where: {
          guildId: guild_id,
          userId: user_id,
          commandName: command_name,
          usedAt: reservation_used_at,
        },
      })
    } catch (error) {
      logger.error({ err: safe_error_details(error), guild_id, user_id, command_name }, 'Erro ao liberar cooldown após falha de comando')
    }
  },

  clearCache(guild_id?: string): void {
    if (!guild_id) {
      cooldown_cache.clear()
      return
    }

    // Keys are bounded. Rebuilding individual keys is preferable to exposing
    // the cache internals just for prefix deletion; configured routes normally
    // know which command changed, while a guild-wide clear can safely flush all.
    cooldown_cache.clear()
  },

  async isUserAdmin(_guild_id: string, _user_id: string, member: { permissions: { has: (permission: bigint) => boolean } } | null): Promise<boolean> {
    return Boolean(member?.permissions.has(0x8n))
  },
}
