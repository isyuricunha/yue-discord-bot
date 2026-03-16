import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';
import { safe_reply_ephemeral } from '../../utils/interaction';
import { is_lavalink_player_not_found_error } from '../../utils/safe_error';

const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Para a música, limpa a fila e sai do canal de voz'),

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

    if (!player) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Não estou tocando música no momento.`,
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

    await player.destroy().catch((error: unknown) => {
      if (is_lavalink_player_not_found_error(error)) return
      throw error
    })

    await interaction.reply({
      content: `${EMOJIS.SUCCESS} Música parada e fila limpa por <@${interaction.user.id}>! Saindo do canal...`,
    });
  },
};

export default stopCommand;
