import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import type { Command } from '../index'

import { divorciarCommand } from './divorciar'

export const divorceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('divorce')
    .setDescription('Alias de /divorciar')
    .setDescriptionLocalizations({ 'pt-BR': 'Alias de /divorciar' })
    .addStringOption((opt) =>
      opt
        .setName('nome')
        .setNameLocalizations({ 'pt-BR': 'nome' })
        .setDescription('Nome do personagem')
        .setDescriptionLocalizations({ 'pt-BR': 'Nome do personagem' })
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await divorciarCommand.execute(interaction)
  },
}
