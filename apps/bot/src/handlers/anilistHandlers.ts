import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import type { ButtonInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import { anilistWatchlistService } from '../services/anilistWatchlist.service'

type anilist_custom_id =
  | {
      action: 'watchlist'
      viewerUserId: string
      targetUserId: string
      mediaType: 'all' | 'anime' | 'manga'
      page: number
    }

function parse_custom_id(custom_id: string): anilist_custom_id | null {
  const parts = custom_id.split(':')
  const prefix = parts[0]
  const action = parts[1]
  if (prefix !== 'anilist') return null

  if (action === 'watchlist') {
    const viewerUserId = parts[2]
    const targetUserId = parts[3]
    const mediaType = (parts[4] ?? 'all') as 'all' | 'anime' | 'manga'
    const page_raw = parts[5]
    const page = Number(page_raw)

    if (!viewerUserId || !targetUserId) return null
    if (!['all', 'anime', 'manga'].includes(mediaType)) return null
    if (!Number.isFinite(page) || page < 1) return null

    return { action, viewerUserId, targetUserId, mediaType, page }
  }

  return null
}

function render_lines(input: {
  items: Array<{ title: string; siteUrl: string | null; mediaType: 'anime' | 'manga'; nextAiringAt: number | null; nextAiringEpisode: number | null }>
  offset: number
}) {
  if (input.items.length === 0) return '—'

  return input.items
    .map((item, i) => {
      const idx = input.offset + i + 1
      const url = item.siteUrl ? `\n${item.siteUrl}` : ''

      const next =
        item.mediaType === 'anime' && item.nextAiringAt
          ? `\nPróx.: <t:${item.nextAiringAt}:R>${item.nextAiringEpisode ? ` (ep ${item.nextAiringEpisode})` : ''}`
          : ''

      return `${idx}. **${item.title}** (${item.mediaType})${url}${next}`
    })
    .join('\n\n')
}

export async function handleAniListButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parse_custom_id(interaction.customId)
  if (!parsed) return

  if (parsed.action === 'watchlist') {
    if (interaction.user.id !== parsed.viewerUserId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Só quem executou o comando pode usar estes botões.`, ephemeral: true })
      return
    }

    const { total, items, page, pageSize } = await anilistWatchlistService.list_items({
      userId: parsed.targetUserId,
      page: parsed.page,
      pageSize: 10,
      mediaType: parsed.mediaType,
    })

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const currentPage = Math.min(Math.max(1, page), totalPages)

    const lines = render_lines({
      items: items.map((i) => ({
        title: i.title,
        siteUrl: i.siteUrl,
        mediaType: i.mediaType,
        nextAiringAt: i.nextAiringAt,
        nextAiringEpisode: i.nextAiringEpisode,
      })),
      offset: (currentPage - 1) * pageSize,
    })

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} AniList watchlist`)
      .setDescription(`Usuário: <@${parsed.targetUserId}>\nTotal: **${total}**\nPágina: **${currentPage}/${totalPages}**`)
      .addFields([{ name: 'Itens', value: lines, inline: false }])

    const prev = new ButtonBuilder()
      .setCustomId(`anilist:watchlist:${parsed.viewerUserId}:${parsed.targetUserId}:${parsed.mediaType}:${Math.max(1, currentPage - 1)}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('⬅️ Anterior')
      .setDisabled(currentPage <= 1)

    const next = new ButtonBuilder()
      .setCustomId(`anilist:watchlist:${parsed.viewerUserId}:${parsed.targetUserId}:${parsed.mediaType}:${Math.min(totalPages, currentPage + 1)}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Próxima ➡️')
      .setDisabled(currentPage >= totalPages)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next)

    await interaction.update({ embeds: [embed], components: totalPages > 1 ? [row] : [] })
  }
}
