import type { Message, PartialMessage } from 'discord.js'

import { auditLogService } from '../services/auditLog.service'
import { client } from '../index'
import { logger } from '../utils/logger'

export async function handleMessageDelete(message: Message | PartialMessage) {
  // ✅ Absolute filters - never log these
  if (!message.guild) return
  if (!message.id) return
  if (!message.channelId) return

  // ✅ Handle partial messages
  let resolved: Message | null = message.partial 
    ? await message.fetch().catch(() => null) 
    : message as Message

  // ✅ If fetch failed and we have no data at all - discard silently
  if (!resolved) {
    logger.debug({ messageId: message.id, channelId: message.channelId }, 'Deleted message could not be fetched, skipped logging')
    return
  }

  // ✅ Ignore own bot messages
  if (resolved.author?.id === client.user.id) return

  // ✅ Ignore system messages
  if (resolved.system) return

  // ✅ Ignore bot messages
  if (resolved.author?.bot) return

  // ✅ Ignore messages with no useful content at all
  const hasValidContent = !!resolved.content?.trim()
  const hasAttachments = resolved.attachments.size > 0
  const hasEmbeds = resolved.embeds.length > 0

  if (!hasValidContent && !hasAttachments && !hasEmbeds) {
    return
  }

  // ✅ Ignore messages deleted immediately (less than 1 second lifetime)
  if (Date.now() - resolved.createdTimestamp < 1000) {
    return
  }

  // All validations passed - proceed to log
  await auditLogService.log({
    guildId: message.guild.id,
    action: 'message_delete',
    targetChannelId: message.channelId,
    targetMessageId: message.id,
    targetUserId: resolved.author?.id ?? null,
    data: {
      content: resolved.content ?? null,
      authorTag: resolved.author?.tag ?? null,
      attachments: resolved.attachments.map((a) => a.proxyURL || a.url),
    },
  })
}
