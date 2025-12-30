import type { Client, Guild, GuildMember, Role } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

type guild_punishment_config = {
  muteRoleId: string | null
}

type cache_entry<T> = {
  value: T
  expiresAt: number
}

function now_ms() {
  return Date.now()
}

function has_active_timeout(member: GuildMember) {
  const ts = member.communicationDisabledUntilTimestamp
  return typeof ts === 'number' && ts > now_ms()
}

function can_manage_role(bot_member: GuildMember, role: Role) {
  return bot_member.roles.highest.position > role.position
}

export class PunishmentRoleService {
  private config_cache = new Map<string, cache_entry<guild_punishment_config>>()
  private readonly cache_ttl_ms = 60_000

  constructor(private client: Client) {}

  private async get_config(guild_id: string): Promise<guild_punishment_config> {
    const cached = this.config_cache.get(guild_id)
    const now = now_ms()

    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    const row = await prisma.guildConfig.findUnique({
      where: { guildId: guild_id },
      select: { muteRoleId: true },
    })

    const value: guild_punishment_config = {
      muteRoleId: row?.muteRoleId ?? null,
    }

    this.config_cache.set(guild_id, { value, expiresAt: now + this.cache_ttl_ms })
    return value
  }

  clear_cache(guild_id: string) {
    this.config_cache.delete(guild_id)
  }

  async sync_member(member: GuildMember, reason: string): Promise<void> {
    const guild_id = member.guild.id

    try {
      const config = await this.get_config(guild_id)
      const mute_role_id = config.muteRoleId
      if (!mute_role_id) return

      const should_have = has_active_timeout(member)
      const has_role = member.roles.cache.has(mute_role_id)

      if (should_have === has_role) return

      const guild = member.guild as Guild
      const role = await guild.roles.fetch(mute_role_id).catch(() => null)
      if (!role) return

      const me = await guild.members.fetchMe().catch(() => null)
      if (!me) return

      if (!can_manage_role(me, role)) {
        return
      }

      if (!member.manageable) {
        return
      }

      if (should_have) {
        await member.roles.add(mute_role_id, reason)
        logger.info({ guildId: guild_id, userId: member.user.id, muteRoleId: mute_role_id }, 'Punishment role applied')
      } else {
        await member.roles.remove(mute_role_id, reason)
        logger.info({ guildId: guild_id, userId: member.user.id, muteRoleId: mute_role_id }, 'Punishment role removed')
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error), guildId: guild_id, userId: member.user.id }, 'Failed to sync punishment role')
    }
  }
}

let punishment_role_service: PunishmentRoleService | null = null

export function initPunishmentRoleService(client: Client) {
  punishment_role_service = new PunishmentRoleService(client)
}

export function getPunishmentRoleService() {
  return punishment_role_service
}
