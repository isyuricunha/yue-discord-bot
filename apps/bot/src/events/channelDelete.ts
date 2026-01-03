import type { GuildChannel } from 'discord.js'

import { auditLogService } from '../services/auditLog.service'

export async function handleChannelDelete(channel: GuildChannel) {
  if (!channel.guild) return

  await auditLogService.log({
    guildId: channel.guild.id,
    action: 'channel_delete',
    targetChannelId: channel.id,
    data: {
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId ?? null,
    },
  })
}
