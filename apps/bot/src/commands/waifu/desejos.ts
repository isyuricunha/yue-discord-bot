import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

import { waifuService } from '../../services/waifu.service'

export const desejosCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('desejos')
    .setDescription('Gerenciar wishlist de personagens (estilo Mudae)')
    .setDescriptionLocalizations({ 'pt-BR': 'Gerenciar wishlist de personagens (estilo Mudae)' })
    .addSubcommand((sub) =>
      sub
        .setName('adicionar')
        .setNameLocalizations({ 'pt-BR': 'adicionar' })
        .setDescription('Adicionar um personagem na sua wishlist')
        .setDescriptionLocalizations({ 'pt-BR': 'Adicionar um personagem na sua wishlist' })
        .addStringOption((opt) =>
          opt
            .setName('nome')
            .setNameLocalizations({ 'pt-BR': 'nome' })
            .setDescription('Nome do personagem')
            .setDescriptionLocalizations({ 'pt-BR': 'Nome do personagem' })
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setNameLocalizations({ 'pt-BR': 'remover' })
        .setDescription('Remover um personagem da sua wishlist')
        .setDescriptionLocalizations({ 'pt-BR': 'Remover um personagem da sua wishlist' })
        .addStringOption((opt) =>
          opt
            .setName('nome')
            .setNameLocalizations({ 'pt-BR': 'nome' })
            .setDescription('Nome do personagem')
            .setDescriptionLocalizations({ 'pt-BR': 'Nome do personagem' })
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setNameLocalizations({ 'pt-BR': 'listar' })
        .setDescription('Ver wishlist de alguém')
        .setDescriptionLocalizations({ 'pt-BR': 'Ver wishlist de alguém' })
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Usuário (padrão: você)')
            .setDescriptionLocalizations({ 'pt-BR': 'Usuário (padrão: você)' })
            .setRequired(false)
        )
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
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
      return
    }

    const sub = interaction.options.getSubcommand(true)

    if (sub === 'adicionar') {
      const nome = interaction.options.getString('nome', true)
      await interaction.deferReply({ ephemeral: true })

      await waifuService.ensure_user(interaction.user.id, {
        username: interaction.user.username,
        avatar: interaction.user.avatar,
      })

      const res = await waifuService.wishlist_add({ guildId: interaction.guildId, userId: interaction.user.id, query: nome })
      if (res.success === false) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} ${res.message}` })
        return
      }

      await interaction.editReply({ content: `${EMOJIS.SUCCESS} **${res.characterName}** foi adicionado na sua wishlist.` })
      return
    }

    if (sub === 'remover') {
      const nome = interaction.options.getString('nome', true)
      await interaction.deferReply({ ephemeral: true })

      const res = await waifuService.wishlist_remove({ guildId: interaction.guildId, userId: interaction.user.id, query: nome })
      if (res.success === false) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} ${res.message}` })
        return
      }

      await interaction.editReply({ content: `${EMOJIS.SUCCESS} **${res.characterName}** foi removido da sua wishlist.` })
      return
    }

    if (sub === 'listar') {
      const target = interaction.options.getUser('usuario') ?? interaction.user
      const page = interaction.options.getInteger('pagina') ?? 1

      await interaction.deferReply({ ephemeral: true })

      const { total, items, page: currentPage, pageSize } = await waifuService.wishlist_list({
        guildId: interaction.guildId,
        userId: target.id,
        page,
        pageSize: 10,
      })

      const totalPages = Math.max(1, Math.ceil(total / pageSize))

      const lines =
        items.length > 0
          ? items.map((w, i) => `${(currentPage - 1) * pageSize + i + 1}. ${w.character.name}`).join('\n')
          : '—'

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Wishlist`)
        .setDescription(`Usuário: <@${target.id}>\nTotal: **${total}**\nPágina: **${currentPage}/${totalPages}**`)
        .addFields([{ name: 'Personagens', value: lines, inline: false }])

      if (totalPages <= 1) {
        await interaction.editReply({ embeds: [embed], components: [] })
        return
      }

      const prev = new ButtonBuilder()
        .setCustomId(`waifu:wishlist:${interaction.user.id}:${target.id}:${Math.max(1, currentPage - 1)}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('⬅️ Anterior')
        .setDisabled(currentPage <= 1)

      const next = new ButtonBuilder()
        .setCustomId(`waifu:wishlist:${interaction.user.id}:${target.id}:${Math.min(totalPages, currentPage + 1)}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Próxima ➡️')
        .setDisabled(currentPage >= totalPages)

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next)

      await interaction.editReply({ embeds: [embed], components: [row] })
      return
    }

    await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
  },
}
