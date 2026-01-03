import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from './index'

import { aniListService, type anilist_anime, type anilist_manga } from '../services/anilist.service'
import { anilistWatchlistService } from '../services/anilistWatchlist.service'

type anilist_media = anilist_anime | anilist_manga

function pick_title(title: anilist_media['title']): string {
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

function media_line(item: anilist_media, index: number): string {
  const title = pick_title(item.title)
  const year = item.seasonYear ? ` (${item.seasonYear})` : ''
  const score = typeof item.averageScore === 'number' ? ` — ${item.averageScore}/100` : ''
  const url = item.siteUrl ?? ''
  return `${index}. **${title}**${year}${score}${url ? `\n${url}` : ''}`
}

function media_meta(item: anilist_media): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = []

  if (item.genres?.length) {
    fields.push({ label: 'Gêneros', value: item.genres.slice(0, 6).join(', ') })
  }

  if ('episodes' in item && item.episodes) {
    fields.push({ label: 'Episódios', value: String(item.episodes) })
  }

  if ('chapters' in item && item.chapters) {
    fields.push({ label: 'Capítulos', value: String(item.chapters) })
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
            .setName('tipo')
            .setNameLocalizations({ 'pt-BR': 'tipo' })
            .setDescription('Type: anime or manga')
            .setDescriptionLocalizations({ 'pt-BR': 'Tipo: anime ou mangá' })
            .addChoices(
              { name: 'Anime', value: 'anime' },
              { name: 'Mangá', value: 'manga' }
            )
            .setRequired(false)
        )
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
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setNameLocalizations({ 'pt-BR': 'tipo' })
            .setDescription('Type: anime or manga')
            .setDescriptionLocalizations({ 'pt-BR': 'Tipo: anime ou mangá' })
            .addChoices(
              { name: 'Anime', value: 'anime' },
              { name: 'Mangá', value: 'manga' }
            )
            .setRequired(false)
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
    )
    .addSubcommand((sub) =>
      sub
        .setName('recommend')
        .setNameLocalizations({ 'pt-BR': 'recomendar' })
        .setDescription('Recommend anime by genre')
        .setDescriptionLocalizations({ 'pt-BR': 'Recomendar anime por gênero' })
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setNameLocalizations({ 'pt-BR': 'tipo' })
            .setDescription('Type: anime or manga')
            .setDescriptionLocalizations({ 'pt-BR': 'Tipo: anime ou mangá' })
            .addChoices(
              { name: 'Anime', value: 'anime' },
              { name: 'Mangá', value: 'manga' }
            )
            .setRequired(false)
        )
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
    )
    .addSubcommandGroup((group) =>
      group
        .setName('watchlist')
        .setNameLocalizations({ 'pt-BR': 'watchlist' })
        .setDescription('Manage AniList watchlist and reminders')
        .setDescriptionLocalizations({ 'pt-BR': 'Gerenciar watchlist AniList e lembretes' })
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setNameLocalizations({ 'pt-BR': 'adicionar' })
            .setDescription('Add an anime/manga by title')
            .setDescriptionLocalizations({ 'pt-BR': 'Adicionar anime/mangá por título' })
            .addStringOption((opt) =>
              opt
                .setName('tipo')
                .setNameLocalizations({ 'pt-BR': 'tipo' })
                .setDescription('Type: anime or manga')
                .setDescriptionLocalizations({ 'pt-BR': 'Tipo: anime ou mangá' })
                .addChoices(
                  { name: 'Anime', value: 'anime' },
                  { name: 'Mangá', value: 'manga' }
                )
                .setRequired(false)
            )
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
            .setName('remove')
            .setNameLocalizations({ 'pt-BR': 'remover' })
            .setDescription('Remove an item by AniList ID')
            .setDescriptionLocalizations({ 'pt-BR': 'Remover item pelo ID do AniList' })
            .addStringOption((opt) =>
              opt
                .setName('tipo')
                .setNameLocalizations({ 'pt-BR': 'tipo' })
                .setDescription('Type: anime or manga')
                .setDescriptionLocalizations({ 'pt-BR': 'Tipo: anime ou mangá' })
                .addChoices(
                  { name: 'Anime', value: 'anime' },
                  { name: 'Mangá', value: 'manga' }
                )
                .setRequired(true)
            )
            .addIntegerOption((opt) =>
              opt
                .setName('id')
                .setNameLocalizations({ 'pt-BR': 'id' })
                .setDescription('AniList media ID')
                .setDescriptionLocalizations({ 'pt-BR': 'ID do AniList' })
                .setRequired(true)
                .setMinValue(1)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('list')
            .setNameLocalizations({ 'pt-BR': 'listar' })
            .setDescription('List watchlist')
            .setDescriptionLocalizations({ 'pt-BR': 'Listar watchlist' })
            .addUserOption((opt) =>
              opt
                .setName('usuario')
                .setNameLocalizations({ 'pt-BR': 'usuario' })
                .setDescription('User (default: you)')
                .setDescriptionLocalizations({ 'pt-BR': 'Usuário (padrão: você)' })
                .setRequired(false)
            )
            .addIntegerOption((opt) =>
              opt
                .setName('pagina')
                .setNameLocalizations({ 'pt-BR': 'pagina' })
                .setDescription('Page')
                .setDescriptionLocalizations({ 'pt-BR': 'Página' })
                .setRequired(false)
                .setMinValue(1)
            )
            .addStringOption((opt) =>
              opt
                .setName('tipo')
                .setNameLocalizations({ 'pt-BR': 'tipo' })
                .setDescription('Filter')
                .setDescriptionLocalizations({ 'pt-BR': 'Filtro' })
                .addChoices(
                  { name: 'Todos', value: 'all' },
                  { name: 'Anime', value: 'anime' },
                  { name: 'Mangá', value: 'manga' }
                )
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('dm')
            .setNameLocalizations({ 'pt-BR': 'dm' })
            .setDescription('Enable/disable reminders via DM')
            .setDescriptionLocalizations({ 'pt-BR': 'Ativar/desativar lembretes via DM' })
            .addBooleanOption((opt) =>
              opt
                .setName('ativar')
                .setNameLocalizations({ 'pt-BR': 'ativar' })
                .setDescription('Enable DM reminders')
                .setDescriptionLocalizations({ 'pt-BR': 'Ativar lembretes por DM' })
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('channel-set')
            .setNameLocalizations({ 'pt-BR': 'canal-definir' })
            .setDescription('Set the channel for reminders in this server')
            .setDescriptionLocalizations({ 'pt-BR': 'Definir canal de lembretes neste servidor' })
            .addChannelOption((opt) =>
              opt
                .setName('canal')
                .setNameLocalizations({ 'pt-BR': 'canal' })
                .setDescription('Channel')
                .setDescriptionLocalizations({ 'pt-BR': 'Canal' })
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('channel-clear')
            .setNameLocalizations({ 'pt-BR': 'canal-limpar' })
            .setDescription('Clear the channel for reminders in this server')
            .setDescriptionLocalizations({ 'pt-BR': 'Limpar canal de lembretes neste servidor' })
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const group = interaction.options.getSubcommandGroup(false)
    const sub = interaction.options.getSubcommand()

    if (group === 'watchlist') {
      const action = sub

      if (action === 'add') {
        const kind = (interaction.options.getString('tipo') ?? 'anime') as 'anime' | 'manga'
        const title = interaction.options.getString('titulo', true)

        await interaction.deferReply({ ephemeral: true })

        await anilistWatchlistService.ensure_user(interaction.user.id, {
          username: interaction.user.username,
          avatar: interaction.user.avatar,
        })

        try {
          const media = await anilistWatchlistService.add_by_title({
            userId: interaction.user.id,
            mediaType: kind,
            title,
          })

          await interaction.editReply({
            content:
              `${EMOJIS.SUCCESS} Adicionado na sua watchlist: **${media.title}** (${kind}).` +
              `\nID: **${media.id}**` +
              (media.siteUrl ? `\n${media.siteUrl}` : ''),
          })
        } catch {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Falha ao adicionar na watchlist (tente um título mais específico).` })
        }

        return
      }

      if (action === 'remove') {
        const kind = interaction.options.getString('tipo', true) as 'anime' | 'manga'
        const media_id = interaction.options.getInteger('id', true)

        await interaction.deferReply({ ephemeral: true })

        const removed = await anilistWatchlistService.remove({
          userId: interaction.user.id,
          mediaType: kind,
          mediaId: media_id,
        })

        await interaction.editReply({
          content: removed
            ? `${EMOJIS.SUCCESS} Removido da sua watchlist: (${kind}) ID ${media_id}.`
            : `${EMOJIS.WARNING} Nada para remover: (${kind}) ID ${media_id}.`,
        })

        return
      }

      if (action === 'list') {
        const target = interaction.options.getUser('usuario') ?? interaction.user
        const page = interaction.options.getInteger('pagina') ?? 1
        const filter = (interaction.options.getString('tipo') ?? 'all') as 'all' | 'anime' | 'manga'

        await interaction.deferReply({ ephemeral: true })

        const { total, items, page: currentPage, pageSize } = await anilistWatchlistService.list_items({
          userId: target.id,
          page,
          pageSize: 10,
          mediaType: filter,
        })

        const totalPages = Math.max(1, Math.ceil(total / pageSize))

        const lines =
          items.length > 0
            ? items
                .map((item, i) => {
                  const idx = (currentPage - 1) * pageSize + i + 1
                  const url = item.siteUrl ? `\n${item.siteUrl}` : ''

                  const next =
                    item.mediaType === 'anime' && item.nextAiringAt
                      ? `\nPróx.: <t:${item.nextAiringAt}:R>${item.nextAiringEpisode ? ` (ep ${item.nextAiringEpisode})` : ''}`
                      : ''

                  return `${idx}. **${item.title}** (${item.mediaType})\nID: **${item.mediaId}**${url}${next}`
                })
                .join('\n\n')
            : '—'

        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJIS.INFO} AniList watchlist`)
          .setDescription(
            `Usuário: <@${target.id}>\nTotal: **${total}**\nPágina: **${currentPage}/${totalPages}**\nFiltro: **${filter}**`
          )
          .addFields([{ name: 'Itens', value: lines, inline: false }])

        if (totalPages <= 1) {
          await interaction.editReply({ embeds: [embed], components: [] })
          return
        }

        const prev_id = `anilist:watchlist:${interaction.user.id}:${target.id}:${filter}:${Math.max(1, currentPage - 1)}`
        const next_id = `anilist:watchlist:${interaction.user.id}:${target.id}:${filter}:${Math.min(totalPages, currentPage + 1)}`

        const prev = new ButtonBuilder()
          .setCustomId(prev_id)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('⬅️ Anterior')
          .setDisabled(currentPage <= 1)

        const next = new ButtonBuilder()
          .setCustomId(next_id)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Próxima ➡️')
          .setDisabled(currentPage >= totalPages)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next)

        await interaction.editReply({ embeds: [embed], components: [row] })
        return
      }

      if (action === 'dm') {
        const enabled = interaction.options.getBoolean('ativar', true)
        await interaction.deferReply({ ephemeral: true })

        await anilistWatchlistService.set_dm_enabled(interaction.user.id, enabled)

        await interaction.editReply({
          content: enabled
            ? `${EMOJIS.SUCCESS} Lembretes por DM ativados.`
            : `${EMOJIS.SUCCESS} Lembretes por DM desativados.`,
        })

        return
      }

      if (action === 'channel-set') {
        if (!interaction.guildId) {
          await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
          return
        }

        const channel = interaction.options.getChannel('canal', true)
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
          await interaction.reply({ content: `${EMOJIS.ERROR} Canal inválido.`, ephemeral: true })
          return
        }

        await interaction.deferReply({ ephemeral: true })

        await anilistWatchlistService.set_channel_for_guild({
          userId: interaction.user.id,
          guildId: interaction.guildId,
          channelId: channel.id,
        })

        await interaction.editReply({ content: `${EMOJIS.SUCCESS} Canal de lembretes definido para <#${channel.id}>.` })
        return
      }

      if (action === 'channel-clear') {
        if (!interaction.guildId) {
          await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
          return
        }

        await interaction.deferReply({ ephemeral: true })
        await anilistWatchlistService.clear_channel_for_guild({ userId: interaction.user.id, guildId: interaction.guildId })
        await interaction.editReply({ content: `${EMOJIS.SUCCESS} Canal de lembretes removido deste servidor.` })
        return
      }

      await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
      return
    }

    const kind = (interaction.options.getString('tipo') ?? 'anime') as 'anime' | 'manga'

    if (sub === 'search') {
      const title = interaction.options.getString('titulo', true)

      await interaction.deferReply()

      try {
        const results =
          kind === 'manga'
            ? await aniListService.search_manga_by_title({ title, perPage: 5 })
            : await aniListService.search_anime_by_title({ title, perPage: 5 })

        if (results.length === 0) {
          await interaction.editReply({ content: `${EMOJIS.WARNING} Nenhum resultado encontrado.` })
          return
        }

        const top = results[0]

        const description = top.description ? shorten(strip_html(top.description), 400) : ''

        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJIS.INFO} ${kind === 'manga' ? 'Mangá' : 'Anime'}: resultados para "${shorten(title, 60)}"`)
          .setDescription(results.map((r, idx) => media_line(r, idx + 1)).join('\n\n'))

        if (description) {
          embed.addFields([{ name: 'Sobre o 1º resultado', value: description, inline: false }])
        }

        const meta = media_meta(top)
        if (meta.length) {
          embed.addFields(meta.map((m) => ({ name: m.label, value: m.value, inline: true })))
        }

        const image = top.coverImage?.extraLarge ?? top.coverImage?.large
        if (image) embed.setThumbnail(image)

        await interaction.editReply({ embeds: [embed] })
      } catch {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Falha ao buscar no AniList.` })
      }

      return
    }

    if (sub === 'trending') {
      const count = interaction.options.getInteger('quantidade') ?? 10

      await interaction.deferReply()

      try {
        const results =
          kind === 'manga'
            ? await aniListService.trending_manga({ perPage: count })
            : await aniListService.trending_anime({ perPage: count })

        const top = results[0]
        const description = top?.description ? shorten(strip_html(top.description), 400) : ''

        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJIS.INFO} ${kind === 'manga' ? 'Mangá' : 'Anime'} trending`)

        if (results.length === 0) {
          embed.setDescription('Nenhum resultado.')
        } else {
          embed.setDescription(results.map((r, idx) => media_line(r, idx + 1)).join('\n\n'))

          if (description) {
            embed.addFields([{ name: 'Destaque', value: description, inline: false }])
          }

          if (top) {
            const meta = media_meta(top)
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
        const results =
          kind === 'manga'
            ? await aniListService.recommend_manga_by_genre({ genre, perPage: count })
            : await aniListService.recommend_anime_by_genre({ genre, perPage: count })

        const top = results[0]
        const description = top?.description ? shorten(strip_html(top.description), 400) : ''

        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJIS.INFO} Recomendações (${kind === 'manga' ? 'mangá' : 'anime'}): ${shorten(genre, 30)}`)

        if (results.length === 0) {
          embed.setDescription('Nenhum resultado.')
        } else {
          embed.setDescription(results.map((r, idx) => media_line(r, idx + 1)).join('\n\n'))

          if (description) {
            embed.addFields([{ name: 'Destaque', value: description, inline: false }])
          }

          if (top) {
            const meta = media_meta(top)
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
