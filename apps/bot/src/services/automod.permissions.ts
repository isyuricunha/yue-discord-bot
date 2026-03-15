import { PermissionFlagsBits, type PermissionsBitField } from 'discord.js'

type automod_action = 'delete' | 'warn' | 'mute' | 'kick' | 'ban'

export function required_channel_permissions_for_automod_action(action: automod_action): bigint[] {
  const perms: bigint[] = [PermissionFlagsBits.ManageMessages]

  switch (action) {
    case 'delete':
    case 'warn':
      return perms
    case 'mute':
      perms.push(PermissionFlagsBits.ModerateMembers)
      return perms
    case 'kick':
      perms.push(PermissionFlagsBits.KickMembers)
      return perms
    case 'ban':
      perms.push(PermissionFlagsBits.BanMembers)
      return perms
  }
}

export function can_apply_automod_action(
  action: automod_action,
  bot_permissions: Pick<PermissionsBitField, 'has'>,
): { ok: boolean; missing: bigint[] } {
  const required = required_channel_permissions_for_automod_action(action)
  const missing = required.filter((perm) => !bot_permissions.has(perm))
  return { ok: missing.length === 0, missing }
}
