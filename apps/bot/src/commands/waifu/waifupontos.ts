import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

import { waifuService } from '../../services/waifu.service'

export const waifupontosCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('waifupontos')
    .setDescription('Ver pontos do sistema de waifus (popularidade AniList)')
    .setDescriptionLocalizations({ 'pt-BR': 'Ver pontos do sistema de waifus (popularidade AniList)' })
    .addSubcommand((sub) =>
      sub
        .setName('meu')
        .setNameLocalizations({ 'pt-BR': 'meu' })
        .setDescription('Ver seus pontos e seu total de casamentos no servidor')
        .setDescriptionLocalizations({ 'pt-BR': 'Ver seus pontos e seu total de casamentos no servidor' })
    )
    .addSubcommand((sub) =>
      sub
        .setName('rank')
        .setNameLocalizations({ 'pt-BR': 'rank' })
        .setDescription('Ver ranking de pontos do servidor')
        .setDescriptionLocalizations({ 'pt-BR': 'Ver ranking de pontos do servidor' })
        .addIntegerOption((opt) =>
          opt
            .setName('pagina')
            .setNameLocalizations({ 'pt-BR': 'pagina' })
            .setDescription('Página (padrão: 1)')
            .setDescriptionLocalizations({ 'pt-BR': 'Página (padrão: 1)' })
            .setRequired(false)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.` })
      return
    }

    const sub = interaction.options.getSubcommand(true)

    await interaction.deferReply()

    if (sub === 'meu') {
      const res = await waifuService.points_me({ guildId: interaction.guildId, userId: interaction.user.id })

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Waifu pontos`)
        .setDescription(`Usuário: <@${interaction.user.id}>`)
        .addFields([
          { name: 'Pontos', value: `**${res.totalValue}**`, inline: true },
          { name: 'Casamentos', value: `**${res.totalClaims}**`, inline: true },
        ])

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'rank') {
      const page = interaction.options.getInteger('pagina') ?? 1
      const pageSize = 10

      const res = await waifuService.points_rank({ guildId: interaction.guildId, page, pageSize })

      const totalPages = Math.max(1, Math.ceil(res.total / res.pageSize))

      const lines =
        res.rows.length > 0
          ? res.rows
              .map((r, i) => `${(res.page - 1) * res.pageSize + i + 1}. <@${r.userId}> — **${r.totalValue}** pts`)
              .join('\n')
          : '—'

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Ranking waifu pontos`)
        .setDescription(`Página: **${res.page}/${totalPages}**\nTotal de usuários: **${res.total}**`)
        .addFields([{ name: 'Ranking', value: lines, inline: false }])

      await interaction.editReply({ embeds: [embed] })
      return
    }

    await interaction.editReply({ content: `${EMOJIS.ERROR} Subcomando inválido.` })
  },
}
