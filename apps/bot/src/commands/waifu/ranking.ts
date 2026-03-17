import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

import { waifuService } from '../../services/waifu.service'
import { safe_reply_ephemeral } from '../../utils/interaction'

function format_line_global(position: number, username: string, totalWaifus: number, totalValue: number) {
  return `**#${position}** ${username} — **${totalWaifus}** waifus — **${totalValue.toLocaleString('pt-BR')}** pts`
}

function format_line_local(position: number, username: string, totalWaifus: number, totalValue: number) {
  return `**#${position}** ${username} — **${totalWaifus}** waifus — **${totalValue.toLocaleString('pt-BR')}** pts`
}

export const rankingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setNameLocalizations({ 'pt-BR': 'ranking' })
    .setDescription('Ver o ranking de waifus do servidor')
    .setDescriptionLocalizations({ 'pt-BR': 'Ver o ranking de waifus do servidor' })
    .addBooleanOption((option) =>
      option
        .setName('global')
        .setNameLocalizations({ 'pt-BR': 'global' })
        .setDescription('Mostrar ranking global (somando todos os servidores)')
        .setDescriptionLocalizations({ 'pt-BR': 'Mostrar ranking global (somando todos os servidores)' })
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setNameLocalizations({ 'pt-BR': 'limite' })
        .setDescription('Quantidade de usuários a mostrar (1-25)')
        .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de usuários a mostrar (1-25)' })
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
      })
      return
    }

    const is_global = interaction.options.getBoolean('global') ?? false
    const limit = interaction.options.getInteger('limite') ?? 10

    if (is_global) {
      const res = await waifuService.points_rank_global({ page: 1, pageSize: limit })

      if (res.rows.length === 0) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.INFO} Ainda não há dados de waifus global.`,
        })
        return
      }

      // Get usernames from database
      const userIds = res.rows.map((r) => r.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      })

      const usernameById = new Map(users.map((u) => [u.id, u.username ?? 'Usuário']))

      // Fetch users not in database from Discord
      const missing = userIds.filter((id) => !usernameById.has(id))
      if (missing.length > 0) {
        const fetched = await Promise.all(
          missing.map(async (id) => {
            const user = await interaction.client.users.fetch(id).catch(() => null)
            return user ? { id: user.id, username: user.username } : null
          })
        )

        for (const item of fetched) {
          if (!item) continue
          usernameById.set(item.id, item.username)
        }
      }

      const lines = res.rows.map((row, idx) =>
        format_line_global(
          idx + 1,
          usernameById.get(row.userId) ?? row.userId,
          row.totalWaifus,
          row.totalValue
        )
      )

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.TROPHY} Ranking Global de Waifus`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Mostrando top ${res.rows.length} | Total de jogadores: ${res.total}` })
        .setTimestamp()

      await interaction.reply({ embeds: [embed] })
      return
    }

    // Server-specific ranking
    const page = 1
    const pageSize = limit

    const res = await waifuService.points_rank({ guildId: interaction.guild.id, page, pageSize })

    if (res.rows.length === 0) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.INFO} Ainda não há dados de waifus neste servidor.`,
      })
      return
    }

    // Get waifu counts per user in this server
    const userIds = res.rows.map((r) => r.userId)
    const waifuCounts = await prisma.waifuClaim.groupBy({
      by: ['userId'],
      where: { guildId: interaction.guild.id, userId: { in: userIds } },
      _count: { characterId: true },
    })

    const waifuCountMap = new Map(waifuCounts.map((w) => [w.userId, w._count.characterId]))

    // Get usernames from guild members
    const members = await prisma.guildMember.findMany({
      where: { guildId: interaction.guild.id, userId: { in: userIds } },
      select: { userId: true, username: true },
    })

    const usernameById = new Map(members.map((m) => [m.userId, m.username]))

    // Fetch users not in database from Discord
    const missing = userIds.filter((id) => !usernameById.has(id))
    if (missing.length > 0) {
      const fetched = await Promise.all(
        missing.map(async (id) => {
          const user = await interaction.client.users.fetch(id).catch(() => null)
          return user ? { id: user.id, username: user.username } : null
        })
      )

      for (const item of fetched) {
        if (!item) continue
        usernameById.set(item.id, item.username)
      }
    }

    const lines = res.rows.map((row, idx) =>
      format_line_local(
        idx + 1,
        usernameById.get(row.userId) ?? row.userId,
        waifuCountMap.get(row.userId) ?? 0,
        row.totalValue
      )
    )

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.TROPHY} Ranking de Waifus`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Mostrando top ${res.rows.length} | Total de jogadores: ${res.total}` })
      .setTimestamp()

    await interaction.reply({ embeds: [embed] })
  },
}
