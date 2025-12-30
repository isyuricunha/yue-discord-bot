import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import type { Command } from '../index'

import { meuharemCommand } from './meuharem'

export const haremCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('harem')
    .setDescription('Alias de /meuharem')
    .setDescriptionLocalizations({ 'pt-BR': 'Alias de /meuharem' })
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
    await meuharemCommand.execute(interaction)
  },
}
