import type { FastifyBaseLogger } from 'fastify'
import { is_guild_admin } from '../internal/bot_internal_api'

type auth_user = {
  userId?: string
  guilds?: string[]
  isOwner?: boolean
  verifiedGuildIds?: string[]
  liveGuildAuthorizationChecked?: boolean
}

export type guild_admin_checker = (
  guild_id: string,
  user_id: string,
  log: FastifyBaseLogger
) => Promise<{ isAdmin: boolean }>

export function request_guild_id(params: unknown): string | null {
  if (!params || typeof params !== 'object') return null

  const guild_id = (params as Record<string, unknown>).guildId
  if (typeof guild_id !== 'string') return null

  const normalized = guild_id.trim()
  return normalized.length > 0 ? normalized : null
}

export async function verify_live_guild_access(
  user: auth_user,
  guild_id: string,
  log: FastifyBaseLogger,
  check_admin: guild_admin_checker = is_guild_admin
): Promise<boolean> {
  if (user.isOwner) return true

  user.liveGuildAuthorizationChecked = true

  const normalized_guild_id = guild_id.trim()
  const user_id = typeof user.userId === 'string' ? user.userId.trim() : ''
  if (!normalized_guild_id || !user_id) return false

  const { isAdmin } = await check_admin(normalized_guild_id, user_id, log)
  if (!isAdmin) return false

  const verified_guild_ids = Array.isArray(user.verifiedGuildIds) ? user.verifiedGuildIds : []
  if (!verified_guild_ids.includes(normalized_guild_id)) {
    user.verifiedGuildIds = [...verified_guild_ids, normalized_guild_id]
  }

  return true
}

export function can_access_guild(user: auth_user, guild_id: string): boolean {
  if (user.isOwner) return true

  // In the full API pipeline, live authorization is authoritative and JWT guild
  // claims are presentation metadata only. The fallback keeps route modules usable
  // in isolation, where the global authenticate decorator is not installed.
  if (user.liveGuildAuthorizationChecked) {
    return Boolean(user.verifiedGuildIds?.includes(guild_id))
  }

  return Boolean(user.guilds?.includes(guild_id))
}
