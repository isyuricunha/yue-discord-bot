import type { Message } from 'discord.js'

import type { conversation_message } from './groq_conversation_store'

export function conversation_key_from_message(message: Message): string {
  return `${message.guildId ?? 'noguild'}:${message.channelId}:${message.author.id}`
}

export async function is_reply_to_bot(message: Message): Promise<boolean> {
  const bot_id = message.client.user?.id
  if (!bot_id) return false

  const referenced = message.reference?.messageId
  if (!referenced) return false

  const cached = message.channel?.messages?.cache?.get(referenced)
  if (cached) return cached.author?.id === bot_id

  const fetched = await message.fetchReference().catch(() => null)
  if (!fetched) return false

  return fetched.author?.id === bot_id
}

export function build_history_for_prompt(history: conversation_message[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const base = history
    .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.trim() }))

  return base
}
