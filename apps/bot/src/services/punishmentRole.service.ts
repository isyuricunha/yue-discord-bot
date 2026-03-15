import type { Client, Guild, GuildMember, Role } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

type guild_punishment_config = {
  muteRoleId: string | null
  muteRoleIds: string[]
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

function normalize_role_ids(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

class PunishmentRoleService {
  private config_cache = new Map<string, cache_entry<guild_punishment_config>>()
  private readonly cache_ttl_ms = 60_000

  constructor(_client: Client) {}

  private async get_config(guild_id: string): Promise<guild_punishment_config> {
    const cached = this.config_cache.get(guild_id)
    const now = now_ms()

    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    const row = await prisma.guildConfig.findUnique({
      where: { guildId: guild_id },
      select: { muteRoleId: true, muteRoleIds: true },
    })

    const mute_role_id = row?.muteRoleId ?? null
    const mute_role_ids = normalize_role_ids(row?.muteRoleIds)
    const effective_role_ids = mute_role_ids.length > 0 ? mute_role_ids : (mute_role_id ? [mute_role_id] : [])

    const value: guild_punishment_config = {
      muteRoleId: mute_role_id,
      muteRoleIds: effective_role_ids,
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
      const mute_role_ids = config.muteRoleIds
      if (mute_role_ids.length === 0) return

      const should_have = has_active_timeout(member)

      const guild = member.guild as Guild
      const me = await guild.members.fetchMe().catch(() => null)
      if (!me) return

      if (!member.manageable) {
        return
      }

      let did_change = false

      for (const role_id of mute_role_ids) {
        const has_role = member.roles.cache.has(role_id)
        if (should_have === has_role) continue

        const role = await guild.roles.fetch(role_id).catch(() => null)
        if (!role) continue

        if (!can_manage_role(me, role)) {
          continue
        }

        if (should_have) {
          await member.roles.add(role_id, reason)
          did_change = true
          logger.info({ guildId: guild_id, userId: member.user.id, muteRoleId: role_id }, 'Punishment role applied')
        } else {
          await member.roles.remove(role_id, reason)
          did_change = true
          logger.info({ guildId: guild_id, userId: member.user.id, muteRoleId: role_id }, 'Punishment role removed')
        }
      }

      if (!did_change) return
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
