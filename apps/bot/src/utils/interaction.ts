import { MessageFlags, MessageFlagsBitField } from 'discord.js'
import type {
  InteractionReplyOptions,
  InteractionEditReplyOptions,
  RepliableInteraction,
} from 'discord.js'

type replyable_interaction = RepliableInteraction & {
  replied?: boolean
  deferred?: boolean
}

function with_ephemeral_flags<T extends { flags?: InteractionReplyOptions['flags']; ephemeral?: boolean }>(options: T): T {
  const current = MessageFlagsBitField.resolve((options.flags ?? 0) as any)
  const next =
    typeof current === 'bigint' ? current | BigInt(MessageFlags.Ephemeral) : (current as number) | MessageFlags.Ephemeral

  const cloned = { ...options, flags: next } as T
  if ('ephemeral' in cloned) delete cloned.ephemeral
  return cloned
}

function without_flags<T extends { flags?: unknown; ephemeral?: unknown }>(options: T): Omit<T, 'flags' | 'ephemeral'> {
  const cloned = { ...options } as T
  if ('flags' in cloned) delete (cloned as { flags?: unknown }).flags
  if ('ephemeral' in cloned) delete (cloned as { ephemeral?: unknown }).ephemeral
  return cloned as Omit<T, 'flags' | 'ephemeral'>
}

export async function safe_defer_ephemeral(interaction: replyable_interaction): Promise<void> {
  if (interaction.deferred || interaction.replied) return
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
}

export async function safe_reply_ephemeral(
  interaction: replyable_interaction,
  options: InteractionReplyOptions
): Promise<void> {
  const payload = with_ephemeral_flags(options)

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload)
    return
  }

  await interaction.reply(payload)
}

export async function safe_edit_reply(
  interaction: replyable_interaction,
  options: InteractionEditReplyOptions
): Promise<void> {
  await interaction.editReply(options)
}

export async function safe_reply_or_edit_ephemeral(
  interaction: replyable_interaction,
  options: InteractionReplyOptions
): Promise<void> {
  const payload = with_ephemeral_flags(options)

  if (interaction.deferred) {
    await interaction.editReply(without_flags(payload) as InteractionEditReplyOptions)
    return
  }

  if (interaction.replied) {
    await interaction.followUp(payload)
    return
  }

  await interaction.reply(payload)
}
