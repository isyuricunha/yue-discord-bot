import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';
import { safe_reply_ephemeral } from '../../utils/interaction';

const skipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pular a música que está tocando no momento'),

  async execute(interaction) {
    if (!interaction.guildId || !interaction.member || !('voice' in interaction.member)) return;

    const { voice } = interaction.member as any;
    if (!voice.channelId) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Você precisa estar em um canal de voz.`,
      });
      return;
    }

    if (!musicService) return;

    const player = musicService.kazagumo.players.get(interaction.guildId);

    if (!player || !player.playing) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Não há nenhuma música tocando no momento.`,
      });
      return;
    }

    if (player.voiceId !== voice.channelId) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Tente entrar no meu canal (\`<#${player.voiceId}>\`)!`,
      });
      return;
    }

    if (player.textId !== interaction.channelId) {
      player.setTextChannel(interaction.channelId);
    }

    const currentTrack = player.queue.current;
    player.skip();

    await interaction.reply({
      content: `${EMOJIS.SUCCESS} **${currentTrack?.title}** pulada por <@${interaction.user.id}>!`,
    });
  },
};

export default skipCommand;
