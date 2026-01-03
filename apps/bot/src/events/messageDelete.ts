import type { Message, PartialMessage } from 'discord.js'

import { auditLogService } from '../services/auditLog.service'

export async function handleMessageDelete(message: Message | PartialMessage) {
  if (!message.guild) return

  const resolved = message.partial ? await message.fetch().catch(() => null) : message

  await auditLogService.log({
    guildId: message.guild.id,
    action: 'message_delete',
    targetChannelId: message.channelId,
    targetMessageId: message.id,
    targetUserId: resolved?.author?.id ?? null,
    data: {
      content: resolved?.content ?? null,
      authorTag: resolved?.author?.tag ?? null,
    },
  })
}
