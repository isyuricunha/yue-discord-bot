import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

import { waifuService } from '../../services/waifu.service'

export const divorciarCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('divorciar')
    .setDescription('Divorciar de um personagem do seu harem')
    .setDescriptionLocalizations({ 'pt-BR': 'Divorciar de um personagem do seu harem' })
    .addStringOption((opt) =>
      opt
        .setName('nome')
        .setNameLocalizations({ 'pt-BR': 'nome' })
        .setDescription('Nome do personagem')
        .setDescriptionLocalizations({ 'pt-BR': 'Nome do personagem' })
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.` })
      return
    }

    const nome = interaction.options.getString('nome', true)

    await interaction.deferReply()

    const res = await waifuService.divorce({ guildId: interaction.guildId, userId: interaction.user.id, query: nome })

    if (!res.success) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} ${res.message}` })
      return
    }

    await interaction.editReply({ content: `${EMOJIS.SUCCESS} Você se divorciou de **${res.characterName}**.` })
  },
}
