import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';

const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Para a música, limpa a fila e sai do canal de voz'),

  async execute(interaction) {
    if (!interaction.guildId || !interaction.member || !('voice' in interaction.member)) return;

    const { voice } = interaction.member as any;
    if (!voice.channelId) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você precisa estar em um canal de voz.`,
        ephemeral: true,
      });
      return;
    }

    if (!musicService) return;

    const player = musicService.kazagumo.players.get(interaction.guildId);

    if (!player) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Não estou tocando música no momento.`,
        ephemeral: true,
      });
      return;
    }

    if (player.voiceId !== voice.channelId) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Tente entrar no meu canal (\`<#${player.voiceId}>\`)!`,
        ephemeral: true,
      });
      return;
    }

    player.destroy();

    await interaction.reply({
      content: `${EMOJIS.SUCCESS} Música parada e fila limpa por <@${interaction.user.id}>! Saindo do canal...`,
    });
  },
};

export default stopCommand;
