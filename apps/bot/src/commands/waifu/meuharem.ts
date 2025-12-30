import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

import { waifuService } from '../../services/waifu.service'

export const meuharemCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('meuharem')
    .setDescription('Ver seu harem (lista de personagens casados)')
    .setDescriptionLocalizations({ 'pt-BR': 'Ver seu harem (lista de personagens casados)' })
    .addIntegerOption((opt) =>
      opt
        .setName('pagina')
        .setNameLocalizations({ 'pt-BR': 'pagina' })
        .setDescription('Página (padrão: 1)')
        .setDescriptionLocalizations({ 'pt-BR': 'Página (padrão: 1)' })
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
      return
    }

    const page = interaction.options.getInteger('pagina') ?? 1

    await interaction.deferReply({ ephemeral: true })

    const { total, claims, page: currentPage, pageSize } = await waifuService.list_harem({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      page,
      pageSize: 10,
    })

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const lines =
      claims.length > 0
        ? claims.map((c, i) => `${(currentPage - 1) * pageSize + i + 1}. ${c.character.name}`).join('\n')
        : '—'

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} Meu harem`)
      .setDescription(`Usuário: <@${interaction.user.id}>\nTotal: **${total}**\nPágina: **${currentPage}/${totalPages}**`)
      .addFields([{ name: 'Personagens', value: lines, inline: false }])

    if (totalPages <= 1) {
      await interaction.editReply({ embeds: [embed], components: [] })
      return
    }

    const prev = new ButtonBuilder()
      .setCustomId(`waifu:harem:${interaction.user.id}:${Math.max(1, currentPage - 1)}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('⬅️ Anterior')
      .setDisabled(currentPage <= 1)

    const next = new ButtonBuilder()
      .setCustomId(`waifu:harem:${interaction.user.id}:${Math.min(totalPages, currentPage + 1)}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Próxima ➡️')
      .setDisabled(currentPage >= totalPages)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next)

    await interaction.editReply({ embeds: [embed], components: [row] })
  },
}
