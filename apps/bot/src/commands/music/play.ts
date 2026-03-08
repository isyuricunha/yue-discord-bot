import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';

const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Toca uma música a partir do YouTube, Spotify ou SoundCloud')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Nome da música ou link (URL)')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.guildId || !interaction.member || !('voice' in interaction.member)) {
      return;
    }

    const { voice } = interaction.member as any;
    if (!voice.channelId) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você precisa estar em um canal de voz para usar este comando.`,
        ephemeral: true,
      });
      return;
    }

    if (!musicService) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} O sistema de música não está habilitado.`,
        ephemeral: true,
      });
      return;
    }

    const query = interaction.options.getString('query', true);
    await interaction.deferReply();

    let player = musicService.kazagumo.players.get(interaction.guildId);

    if (!player) {
      player = await musicService.kazagumo.createPlayer({
        guildId: interaction.guildId,
        textId: interaction.channelId,
        voiceId: voice.channelId,
        volume: 70,
      });
    } else {
      // Check if user is in the same channel as the bot
      if (player.voiceId !== voice.channelId) {
        await interaction.followUp({
          content: `${EMOJIS.ERROR} Tente entrar no mesmo canal de voz que eu (\`<#${player.voiceId}>\`) para pedir uma música.`,
          ephemeral: true,
        });
        return;
      }
    }

    const result = await musicService.kazagumo.search(query, { requester: interaction.user });

    if (!result.tracks.length) {
      await interaction.followUp(`${EMOJIS.ERROR} Não encontrei resultados para \`${query}\`.`);
      return;
    }

    if (result.type === 'PLAYLIST') {
      for (const track of result.tracks) {
        player.queue.add(track);
      }
      if (!player.playing && !player.paused) await player.play();
      
      await interaction.followUp(
        `${EMOJIS.SUCCESS} A playlist **${result.playlistName}** com \`${result.tracks.length}\` faixas foi adicionada à fila.`
      );
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      if (!player.playing && !player.paused) await player.play();
      
      await interaction.followUp(
        `${EMOJIS.SUCCESS} A faixa **${track.title}** foi adicionada à fila.`
      );
    }
  },
};

export default playCommand;
