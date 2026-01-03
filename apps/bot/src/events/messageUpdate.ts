import type { Message, PartialMessage } from 'discord.js'

import { auditLogService } from '../services/auditLog.service'

export async function handleMessageUpdate(old_message: Message | PartialMessage, new_message: Message | PartialMessage) {
  if (!new_message.guild) return

  const old_resolved = old_message.partial ? await old_message.fetch().catch(() => null) : old_message
  const new_resolved = new_message.partial ? await new_message.fetch().catch(() => null) : new_message

  const old_content = old_resolved?.content ?? null
  const new_content = new_resolved?.content ?? null
  if (old_content === new_content) return

  await auditLogService.log({
    guildId: new_message.guild.id,
    action: 'message_update',
    targetChannelId: new_message.channelId,
    targetMessageId: new_message.id,
    targetUserId: new_resolved?.author?.id ?? null,
    data: {
      oldContent: old_content,
      newContent: new_content,
      authorTag: new_resolved?.author?.tag ?? null,
    },
  })
}
