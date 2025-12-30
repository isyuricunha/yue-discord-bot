import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import type { Command } from '../index'

import { casarCommand } from './casar'

export const marryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('marry')
    .setDescription('Alias de /casar')
    .setDescriptionLocalizations({ 'pt-BR': 'Alias de /casar' }),

  async execute(interaction: ChatInputCommandInteraction) {
    await casarCommand.execute(interaction)
  },
}
