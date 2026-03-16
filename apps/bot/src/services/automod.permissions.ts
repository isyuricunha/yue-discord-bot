import { PermissionFlagsBits, type PermissionsBitField } from 'discord.js'

type automod_action = 'delete' | 'warn' | 'mute' | 'kick' | 'ban'

export function required_channel_permissions_for_automod_action(action: automod_action): bigint[] {
  switch (action) {
    case 'delete':
      return [PermissionFlagsBits.ManageMessages]
    case 'warn':
      return []
    case 'mute':
      return [PermissionFlagsBits.ModerateMembers]
    case 'kick':
      return [PermissionFlagsBits.KickMembers]
    case 'ban':
      return [PermissionFlagsBits.BanMembers]
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
