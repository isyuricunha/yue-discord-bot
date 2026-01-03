import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from './index'

import { aniListService, type anilist_anime } from '../services/anilist.service'

function pick_title(title: anilist_anime['title']): string {
  return title.english ?? title.romaji ?? title.native ?? 'Unknown'
}

function strip_html(input: string): string {
  return input
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

function shorten(input: string, max_len: number): string {
  const trimmed = input.trim()
  if (trimmed.length <= max_len) return trimmed
  return trimmed.slice(0, Math.max(0, max_len - 3)).trimEnd() + '...'
}

function anime_line(item: anilist_anime, index: number): string {
  const title = pick_title(item.title)
  const year = item.seasonYear ? ` (${item.seasonYear})` : ''
  const score = typeof item.averageScore === 'number' ? ` — ${item.averageScore}/100` : ''
  const url = item.siteUrl ?? ''
  return `${index}. **${title}**${year}${score}${url ? `\n${url}` : ''}`
}

function anime_meta(item: anilist_anime): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = []

  if (item.genres?.length) {
    fields.push({ label: 'Gêneros', value: item.genres.slice(0, 6).join(', ') })
  }

  if (item.episodes) {
    fields.push({ label: 'Episódios', value: String(item.episodes) })
  }

  if (item.status) {
    fields.push({ label: 'Status', value: item.status })
  }

  if (item.format) {
    fields.push({ label: 'Formato', value: item.format })
  }

  if (typeof item.averageScore === 'number') {
    fields.push({ label: 'Nota', value: `${item.averageScore}/100` })
  }

  return fields
}

export const animeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('anime')
    .setNameLocalizations({ 'pt-BR': 'anime' })
    .setDescription('Search and get recommendations (AniList)')
    .setDescriptionLocalizations({ 'pt-BR': 'Buscar e receber recomendações (AniList)' })
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setNameLocalizations({ 'pt-BR': 'buscar' })
        .setDescription('Search anime by title')
        .setDescriptionLocalizations({ 'pt-BR': 'Buscar anime por título' })
        .addStringOption((opt) =>
          opt
            .setName('titulo')
            .setNameLocalizations({ 'pt-BR': 'titulo' })
            .setDescription('Title')
            .setDescriptionLocalizations({ 'pt-BR': 'Título' })
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('trending')
        .setNameLocalizations({ 'pt-BR': 'trending' })
        .setDescription('Trending anime right now')
        .setDescriptionLocalizations({ 'pt-BR': 'Animes em alta agora' })
        .addIntegerOption((opt) =>
          opt
            .setName('quantidade')
            .setNameLocalizations({ 'pt-BR': 'quantidade' })
            .setDescription('How many results (1-10)')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantos resultados (1-10)' })
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('recommend')
        .setNameLocalizations({ 'pt-BR': 'recomendar' })
        .setDescription('Recommend anime by genre')
        .setDescriptionLocalizations({ 'pt-BR': 'Recomendar anime por gênero' })
        .addStringOption((opt) =>
          opt
            .setName('genero')
            .setNameLocalizations({ 'pt-BR': 'genero' })
            .setDescription('Genre (e.g. Action, Romance)')
            .setDescriptionLocalizations({ 'pt-BR': 'Gênero (ex: Action, Romance)' })
            .setRequired(true)
            .setMaxLength(30)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('quantidade')
            .setNameLocalizations({ 'pt-BR': 'quantidade' })
            .setDescription('How many results (1-10)')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantos resultados (1-10)' })
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    if (sub === 'search') {
      const title = interaction.options.getString('titulo', true)

      await interaction.deferReply()

      try {
        const results = await aniListService.search_anime_by_title({ title, perPage: 5 })

        if (results.length === 0) {
          await interaction.editReply({ content: `${EMOJIS.WARNING} Nenhum resultado encontrado.` })
          return
        }

        const top = results[0]

        const description = top.description ? shorten(strip_html(top.description), 400) : ''

        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJIS.INFO} Anime: resultados para "${shorten(title, 60)}"`)
          .setDescription(results.map((r, idx) => anime_line(r, idx + 1)).join('\n\n'))

        if (description) {
          embed.addFields([{ name: 'Sobre o 1º resultado', value: description, inline: false }])
        }

        const meta = anime_meta(top)
        if (meta.length) {
          embed.addFields(meta.map((m) => ({ name: m.label, value: m.value, inline: true })))
        }

        const image = top.coverImage?.extraLarge ?? top.coverImage?.large
        if (image) embed.setThumbnail(image)

        await interaction.editReply({ embeds: [embed] })
      } catch (error) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Falha ao buscar no AniList.` })
      }

      return
    }

    if (sub === 'trending') {
      const count = interaction.options.getInteger('quantidade') ?? 10

      await interaction.deferReply()

      try {
        const results = await aniListService.trending_anime({ perPage: count })

        const top = results[0]
        const description = top?.description ? shorten(strip_html(top.description), 400) : ''

        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJIS.INFO} Anime trending`)

        if (results.length === 0) {
          embed.setDescription('Nenhum resultado.')
        } else {
          embed.setDescription(results.map((r, idx) => anime_line(r, idx + 1)).join('\n\n'))

          if (description) {
            embed.addFields([{ name: 'Destaque', value: description, inline: false }])
          }

          if (top) {
            const meta = anime_meta(top)
            if (meta.length) {
              embed.addFields(meta.map((m) => ({ name: m.label, value: m.value, inline: true })))
            }
          }

          const image = top?.coverImage?.extraLarge ?? top?.coverImage?.large
          if (image) embed.setThumbnail(image)
        }

        await interaction.editReply({ embeds: [embed] })
      } catch {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Falha ao buscar trending no AniList.` })
      }

      return
    }

    if (sub === 'recommend') {
      const genre = interaction.options.getString('genero', true)
      const count = interaction.options.getInteger('quantidade') ?? 10

      await interaction.deferReply()

      try {
        const results = await aniListService.recommend_anime_by_genre({ genre, perPage: count })

        const top = results[0]
        const description = top?.description ? shorten(strip_html(top.description), 400) : ''

        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJIS.INFO} Recomendações: ${shorten(genre, 30)}`)

        if (results.length === 0) {
          embed.setDescription('Nenhum resultado.')
        } else {
          embed.setDescription(results.map((r, idx) => anime_line(r, idx + 1)).join('\n\n'))

          if (description) {
            embed.addFields([{ name: 'Destaque', value: description, inline: false }])
          }

          if (top) {
            const meta = anime_meta(top)
            if (meta.length) {
              embed.addFields(meta.map((m) => ({ name: m.label, value: m.value, inline: true })))
            }
          }

          const image = top?.coverImage?.extraLarge ?? top?.coverImage?.large
          if (image) embed.setThumbnail(image)
        }

        await interaction.editReply({ embeds: [embed] })
      } catch {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Falha ao buscar recomendações no AniList.` })
      }

      return
    }

    await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
  },
}
