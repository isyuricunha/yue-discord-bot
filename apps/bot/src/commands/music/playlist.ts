import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../index';

import { reply_with_queue_embed } from './queue';

const playlistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Mostra a playlist/fila de músicas e o que está tocando agora'),

  async execute(interaction) {
    await reply_with_queue_embed(interaction);
  },
};

export default playlistCommand;
