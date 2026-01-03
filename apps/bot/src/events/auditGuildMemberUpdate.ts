import type { GuildMember, PartialGuildMember } from 'discord.js'

import { auditLogService } from '../services/auditLog.service'

function diff_roles(old_ids: string[], new_ids: string[]) {
  const old_set = new Set(old_ids)
  const new_set = new Set(new_ids)

  const added: string[] = []
  const removed: string[] = []

  for (const id of new_set) {
    if (!old_set.has(id)) added.push(id)
  }

  for (const id of old_set) {
    if (!new_set.has(id)) removed.push(id)
  }

  return { added, removed }
}

export async function handleAuditGuildMemberUpdate(old_member: GuildMember | PartialGuildMember, new_member: GuildMember | PartialGuildMember) {
  const resolved_old = old_member.partial ? await old_member.fetch().catch(() => null) : old_member
  const resolved_new = new_member.partial ? await new_member.fetch().catch(() => null) : new_member

  if (!resolved_old || !resolved_new) return

  const guild_id = resolved_new.guild.id

  if (resolved_old.nickname !== resolved_new.nickname) {
    await auditLogService.log({
      guildId: guild_id,
      action: 'member_nick_update',
      targetUserId: resolved_new.user.id,
      data: {
        oldNick: resolved_old.nickname ?? null,
        newNick: resolved_new.nickname ?? null,
      },
    })
  }

  const old_roles = resolved_old.roles.cache.map((r) => r.id)
  const new_roles = resolved_new.roles.cache.map((r) => r.id)

  const { added, removed } = diff_roles(old_roles, new_roles)
  if (added.length > 0 || removed.length > 0) {
    await auditLogService.log({
      guildId: guild_id,
      action: 'member_roles_update',
      targetUserId: resolved_new.user.id,
      data: { addedRoleIds: added, removedRoleIds: removed },
    })
  }
}
