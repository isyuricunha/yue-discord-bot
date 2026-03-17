import { prisma } from '@yuebot/database'
import { DEFAULT_COMMAND_COOLDOWNS } from '@yuebot/shared'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

type cooldown_cache_entry = {
  cooldown_seconds: number
  expires_at_ms: number
}

const cooldown_cache = new Map<string, cooldown_cache_entry>()

function cooldown_cache_key(guild_id: string, command_name: string) {
  return `${guild_id}:${command_name}`
}

const CACHE_TTL_MS = 60_000 // 1 minute cache

export const commandCooldownService = {
  /**
   * Get the cooldown for a command in a guild
   * Returns 0 if no cooldown is set
   */
  async getCooldown(guild_id: string, command_name: string): Promise<number> {
    const key = cooldown_cache_key(guild_id, command_name)
    const now = Date.now()

    const cached = cooldown_cache.get(key)
    if (cached && cached.expires_at_ms > now) {
      return cached.cooldown_seconds
    }

    try {
      // Check database for custom cooldown
      const dbCooldown = await prisma.guildCommandCooldown.findUnique({
        where: {
          guildId_commandName: {
            guildId: guild_id,
            commandName: command_name,
          },
        },
        select: { cooldownSeconds: true },
      })

      // Use custom cooldown or fall back to default
      const cooldown = dbCooldown?.cooldownSeconds ?? DEFAULT_COMMAND_COOLDOWNS[command_name] ?? 0

      cooldown_cache.set(key, { cooldown_seconds: cooldown, expires_at_ms: now + CACHE_TTL_MS })
      return cooldown
    } catch (error) {
      logger.error({ err: safe_error_details(error), guild_id, command_name }, 'Erro ao buscar cooldown de comando')
      return DEFAULT_COMMAND_COOLDOWNS[command_name] ?? 0
    }
  },

  /**
   * Check if a user is on cooldown for a command
   * Returns remaining seconds if on cooldown, 0 if not on cooldown
   */
  async checkCooldown(guild_id: string, user_id: string, command_name: string): Promise<number> {
    const cooldown_seconds = await this.getCooldown(guild_id, command_name)

    if (cooldown_seconds === 0) {
      return 0
    }

    try {
      const lastUsed = await prisma.userCommandCooldown.findFirst({
        where: {
          userId: user_id,
          guildId: guild_id,
          commandName: command_name,
        },
        orderBy: { usedAt: 'desc' },
        select: { usedAt: true },
      })

      if (!lastUsed) {
        return 0
      }

      const now = new Date()
      const cooldown_ms = cooldown_seconds * 1000
      const elapsed_ms = now.getTime() - lastUsed.usedAt.getTime()
      const remaining_seconds = Math.ceil((cooldown_ms - elapsed_ms) / 1000)

      return remaining_seconds > 0 ? remaining_seconds : 0
    } catch (error) {
      logger.error({ err: safe_error_details(error), guild_id, user_id, command_name }, 'Erro ao verificar cooldown de comando')
      return 0
    }
  },

  /**
   * Record a command usage for cooldown tracking
   */
  async recordUsage(guild_id: string, user_id: string, command_name: string): Promise<void> {
    const cooldown_seconds = await this.getCooldown(guild_id, command_name)

    if (cooldown_seconds === 0) {
      return
    }

    try {
      await prisma.userCommandCooldown.create({
        data: {
          userId: user_id,
          guildId: guild_id,
          commandName: command_name,
        },
      })

      // Cleanup old entries (older than the cooldown period + 1 hour)
      const cutoff = new Date(Date.now() - (cooldown_seconds * 1000 + 3600 * 1000))
      await prisma.userCommandCooldown.deleteMany({
        where: {
          guildId: guild_id,
          commandName: command_name,
          usedAt: { lt: cutoff },
        },
      })
    } catch (error) {
      logger.error({ err: safe_error_details(error), guild_id, user_id, command_name }, 'Erro ao registrar uso de comando')
    }
  },

  /**
   * Clear the cache for a specific guild
   */
  clearCache(guild_id?: string): void {
    if (guild_id) {
      // Clear only entries for this guild
      for (const key of cooldown_cache.keys()) {
        if (key.startsWith(`${guild_id}:`)) {
          cooldown_cache.delete(key)
        }
      }
    } else {
      cooldown_cache.clear()
    }
  },

  /**
   * Check if user is admin (to bypass cooldown)
   * This should be called with the member object from Discord
   */
  async isUserAdmin(guild_id: string, user_id: string, member: { permissions: { has: (permission: bigint) => boolean } } | null): Promise<boolean> {
    // If member is null, assume not admin
    if (!member) {
      return false
    }

    // Check if user has administrator permission
    // PermissionFlagsBits.Administrator = 0x8n
    return member.permissions.has(0x8n)
  },
}
