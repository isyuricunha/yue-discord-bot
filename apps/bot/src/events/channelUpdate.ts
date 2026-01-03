import type { GuildChannel } from 'discord.js'

import { auditLogService } from '../services/auditLog.service'
import { Prisma } from '@yuebot/database'

export async function handleChannelUpdate(old_channel: GuildChannel, new_channel: GuildChannel) {
  if (!new_channel.guild) return

  const changes: Record<string, unknown> = {}

  if (old_channel.name !== new_channel.name) {
    changes.name = { old: old_channel.name, new: new_channel.name }
  }

  if (old_channel.parentId !== new_channel.parentId) {
    changes.parentId = { old: old_channel.parentId, new: new_channel.parentId }
  }

  // topic exists only in text-based channels, but we store best-effort
  const old_any = old_channel as unknown as { topic?: unknown }
  const new_any = new_channel as unknown as { topic?: unknown }
  if (old_any.topic !== new_any.topic) {
    changes.topic = { old: old_any.topic ?? null, new: new_any.topic ?? null }
  }

  if (Object.keys(changes).length === 0) return

  await auditLogService.log({
    guildId: new_channel.guild.id,
    action: 'channel_update',
    targetChannelId: new_channel.id,
    data: changes as Prisma.InputJsonValue,
  })
}
