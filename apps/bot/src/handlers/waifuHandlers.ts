import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import type { ButtonInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import { waifuService } from '../services/waifu.service'

function parse_custom_id(custom_id: string): { action: 'claim'; rollId: string } | null {
  const [prefix, action, rollId] = custom_id.split(':')
  if (prefix !== 'waifu') return null
  if (action !== 'claim') return null
  if (!rollId) return null
  return { action, rollId }
}

function format_relative_time(date: Date): string {
  const unix = Math.floor(date.getTime() / 1000)
  return `<t:${unix}:R>`
}

export async function handleWaifuButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parse_custom_id(interaction.customId)
  if (!parsed) return

  await interaction.deferReply({ ephemeral: true })

  const res = await waifuService.claim({ rollId: parsed.rollId, userId: interaction.user.id })

  if (res.success === false) {
    const suffix =
      res.error === 'cooldown' && res.nextClaimAt
        ? ` Próximo claim: ${format_relative_time(res.nextClaimAt)}.`
        : res.error === 'already_claimed' && res.claimedByUserId
          ? ` Dono: <@${res.claimedByUserId}>.`
          : ''

    await interaction.editReply({ content: `${EMOJIS.ERROR} ${res.message}${suffix}` })
    return
  }

  // Update original message to show ownership and disable the button.
  const existing_embed = interaction.message.embeds?.[0]

  const embed = new EmbedBuilder(existing_embed?.data ?? {})
    .setColor(COLORS.SUCCESS)
    .addFields([{ name: 'Casado com', value: `<@${res.claimerUserId}>`, inline: true }])

  const button = new ButtonBuilder()
    .setCustomId(`waifu:claim:${parsed.rollId}`)
    .setStyle(ButtonStyle.Success)
    .setLabel('❤️ Claim')
    .setDisabled(true)

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

  try {
    await interaction.message.edit({ embeds: [embed], components: [row] })
  } catch {
    // ignore (message might not be editable)
  }

  await interaction.editReply({
    content: `${EMOJIS.SUCCESS} Você casou com **${res.characterName}**! Próximo claim: ${format_relative_time(res.nextClaimAt)}.`,
  })
}
