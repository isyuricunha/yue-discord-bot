import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { Command } from '../index'
import { supportService } from '../../services/support/support.service'

export const apoiarCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('apoiar')
    .setDescription('Open the private support payment interface.'),

  async execute(interaction: ChatInputCommandInteraction) {
    await supportService.handle_command(interaction)
  },
}
