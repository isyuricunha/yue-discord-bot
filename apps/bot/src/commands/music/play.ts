import { GuildMember, SlashCommandBuilder } from 'discord.js';
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
    if (!interaction.guildId || !interaction.guild) {
      return;
    }

    // Fetch the member from cache to ensure voice state is available.
    // interaction.member can be APIInteractionGuildMember (no voice state),
    // so we always resolve from the guild member cache.
    const member = interaction.guild.members.cache.get(interaction.user.id)
      ?? (interaction.member instanceof GuildMember ? interaction.member : null);

    const voiceChannelId = member?.voice?.channelId ?? null;

    if (!voiceChannelId) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você precisa estar em um canal de voz para usar este comando.`,
        flags: ['Ephemeral'],
      });
      return;
    }

    if (!musicService) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} O sistema de música não está habilitado.`,
        flags: ['Ephemeral'],
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
        voiceId: voiceChannelId,
        volume: 70,
      });
    } else {
      // Check if user is in the same channel as the bot
      if (player.voiceId !== voiceChannelId) {
        await interaction.followUp({
          content: `${EMOJIS.ERROR} Tente entrar no mesmo canal de voz que eu (\`<#${player.voiceId}>\`) para pedir uma música.`,
          flags: ['Ephemeral'],
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
