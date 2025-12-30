import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import type { Command } from '../index'

import { casarCommand } from './casar'

export const marryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('marry')
    .setDescription('Alias de /casar')
    .setDescriptionLocalizations({ 'pt-BR': 'Alias de /casar' })
    .addStringOption((opt) =>
      opt
        .setName('genero')
        .setNameLocalizations({ 'pt-BR': 'genero' })
        .setDescription('Filtrar gênero (não escolhe personagem, só filtra)')
        .setDescriptionLocalizations({ 'pt-BR': 'Filtrar gênero (não escolhe personagem, só filtra)' })
        .addChoices(
          { name: 'Qualquer', value: 'any' },
          { name: 'Feminino', value: 'female' },
          { name: 'Masculino', value: 'male' }
        )
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await casarCommand.execute(interaction)
  },
}
