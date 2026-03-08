import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';

const skipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pular a música que está tocando no momento'),

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

    if (!player || !player.playing) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Não há nenhuma música tocando no momento.`,
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

    const currentTrack = player.queue.current;
    player.skip();

    await interaction.reply({
      content: `${EMOJIS.SUCCESS} **${currentTrack?.title}** pulada por <@${interaction.user.id}>!`,
    });
  },
};

export default skipCommand;
