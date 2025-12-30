import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import type { ButtonInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import { waifuService } from '../services/waifu.service'

type waifu_custom_id =
  | { action: 'claim'; rollId: string }
  | { action: 'harem'; userId: string; page: number }
  | { action: 'wishlist'; viewerUserId: string; targetUserId: string; page: number }

function parse_custom_id(custom_id: string): waifu_custom_id | null {
  const parts = custom_id.split(':')
  const prefix = parts[0]
  const action = parts[1]
  if (prefix !== 'waifu') return null

  if (action === 'claim') {
    const rollId = parts[2]
    if (!rollId) return null
    return { action, rollId }
  }

  if (action === 'harem') {
    const userId = parts[2]
    const page_raw = parts[3]
    const page = Number(page_raw)
    if (!userId) return null
    if (!Number.isFinite(page) || page < 1) return null
    return { action, userId, page }
  }

  if (action === 'wishlist') {
    const viewerUserId = parts[2]
    const targetUserId = parts[3]
    const page_raw = parts[4]
    const page = Number(page_raw)
    if (!viewerUserId || !targetUserId) return null
    if (!Number.isFinite(page) || page < 1) return null
    return { action, viewerUserId, targetUserId, page }
  }

  return null
}

function format_relative_time(date: Date): string {
  const unix = Math.floor(date.getTime() / 1000)
  return `<t:${unix}:R>`
}

async function handle_harem_page(interaction: ButtonInteraction, input: { userId: string; page: number }): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
    return
  }

  if (interaction.user.id !== input.userId) {
    await interaction.reply({ content: `${EMOJIS.ERROR} Só quem executou o comando pode usar estes botões.`, ephemeral: true })
    return
  }

  const { total, claims, page, pageSize } = await waifuService.list_harem({
    guildId: interaction.guildId,
    userId: input.userId,
    page: input.page,
    pageSize: 10,
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const lines =
    claims.length > 0
      ? claims.map((c, i) => `${(currentPage - 1) * pageSize + i + 1}. ${c.character.name}`).join('\n')
      : '—'

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.INFO} Meu harem`)
    .setDescription(`Usuário: <@${input.userId}>\nTotal: **${total}**\nPágina: **${currentPage}/${totalPages}**`)
    .addFields([{ name: 'Personagens', value: lines, inline: false }])

  const prev = new ButtonBuilder()
    .setCustomId(`waifu:harem:${input.userId}:${Math.max(1, currentPage - 1)}`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel('⬅️ Anterior')
    .setDisabled(currentPage <= 1)

  const next = new ButtonBuilder()
    .setCustomId(`waifu:harem:${input.userId}:${Math.min(totalPages, currentPage + 1)}`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Próxima ➡️')
    .setDisabled(currentPage >= totalPages)

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next)

  await interaction.update({ embeds: [embed], components: totalPages > 1 ? [row] : [] })
}

async function handle_wishlist_page(
  interaction: ButtonInteraction,
  input: { viewerUserId: string; targetUserId: string; page: number }
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
    return
  }

  if (interaction.user.id !== input.viewerUserId) {
    await interaction.reply({ content: `${EMOJIS.ERROR} Só quem executou o comando pode usar estes botões.`, ephemeral: true })
    return
  }

  const { total, items, page, pageSize } = await waifuService.wishlist_list({
    guildId: interaction.guildId,
    userId: input.targetUserId,
    page: input.page,
    pageSize: 10,
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const lines =
    items.length > 0
      ? items.map((w, i) => `${(currentPage - 1) * pageSize + i + 1}. ${w.character.name}`).join('\n')
      : '—'

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.INFO} Wishlist`)
    .setDescription(`Usuário: <@${input.targetUserId}>\nTotal: **${total}**\nPágina: **${currentPage}/${totalPages}**`)
    .addFields([{ name: 'Personagens', value: lines, inline: false }])

  const prev = new ButtonBuilder()
    .setCustomId(`waifu:wishlist:${input.viewerUserId}:${input.targetUserId}:${Math.max(1, currentPage - 1)}`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel('⬅️ Anterior')
    .setDisabled(currentPage <= 1)

  const next = new ButtonBuilder()
    .setCustomId(`waifu:wishlist:${input.viewerUserId}:${input.targetUserId}:${Math.min(totalPages, currentPage + 1)}`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Próxima ➡️')
    .setDisabled(currentPage >= totalPages)

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next)

  await interaction.update({ embeds: [embed], components: totalPages > 1 ? [row] : [] })
}

export async function handleWaifuButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parse_custom_id(interaction.customId)
  if (!parsed) return

  if (parsed.action === 'harem') {
    await handle_harem_page(interaction, { userId: parsed.userId, page: parsed.page })
    return
  }

  if (parsed.action === 'wishlist') {
    await handle_wishlist_page(interaction, {
      viewerUserId: parsed.viewerUserId,
      targetUserId: parsed.targetUserId,
      page: parsed.page,
    })
    return
  }

  await interaction.deferReply()

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
