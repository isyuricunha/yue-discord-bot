import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';
import { safe_reply_ephemeral } from '../../utils/interaction';

const volumeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Altera o volume da música que está tocando')
    .addIntegerOption((option) =>
      option
        .setName('porcentagem')
        .setDescription('Novo volume (1 a 150)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(150)
    ),

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

    const volume = interaction.options.getInteger('porcentagem', true);
    player.setVolume(volume);

    await interaction.reply({
      content: `${EMOJIS.SUCCESS} Volume alterado para **${volume}%** por <@${interaction.user.id}>!`,
    });
  },
};

export default volumeCommand;
