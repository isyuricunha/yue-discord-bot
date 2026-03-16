import { GuildMember, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';

export type SearchAttempt = {
  label: string;
  source?: string;
};

export function build_search_attempts(query: string): SearchAttempt[] {
  const is_url = /^https?:\/\//i.test(query);
  if (is_url) {
    return [{ label: 'url' }];
  }

  return [
    { label: 'default' },
    { label: 'youtube', source: 'ytsearch:' },
    { label: 'youtube_music', source: 'ytmsearch:' },
    { label: 'soundcloud', source: 'scsearch:' },
    { label: 'spotify', source: 'spsearch:' },
  ];
}

export async function search_with_fallback<T extends { tracks: unknown[] }>(
  search: (query: string, options: { requester: unknown; source?: string }) => Promise<T>,
  query: string,
  requester: unknown
): Promise<T | null> {
  const attempts = build_search_attempts(query);

  for (const attempt of attempts) {
    const result = await search(query, {
      requester,
      ...(attempt.source ? { source: attempt.source } : null),
    });

    if (result.tracks.length) return result;
  }

  return null;
}

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

    const had_active_track = Boolean(player.queue.current) && (player.playing || player.paused);

    try {
      const result = await search_with_fallback(
        (q, options) => musicService.kazagumo.search(q, options as any),
        query,
        interaction.user
      );

      if (!result || !result.tracks.length) {
        await interaction.followUp(`${EMOJIS.ERROR} Não encontrei resultados para \`${query}\`.`);
        return;
      }

      if (result.type === 'PLAYLIST') {
        player.queue.add(result.tracks as any);

        const should_start = !had_active_track && !player.playing && !player.paused;
        if (should_start) {
          await player.play();
        }

        const now_playing = player.queue.current;
        const now_playing_text = now_playing
          ? `\n**Tocando agora:** ${now_playing.title}`
          : '';

        await interaction.followUp(
          `${EMOJIS.SUCCESS} Playlist **${result.playlistName}** adicionada à fila com **${result.tracks.length}** músicas!${now_playing_text}`
        );
      } else {
        const track = result.tracks[0];
        player.queue.add(track);

        const should_start = !had_active_track && !player.playing && !player.paused;
        if (should_start) {
          await player.play();
        }

        const now_playing = player.queue.current;
        const now_playing_text = now_playing
          ? `\n**Tocando agora:** ${now_playing.title}`
          : '';

        await interaction.followUp(
          `${EMOJIS.SUCCESS} Música **${track.title}** adicionada à fila!${now_playing_text}`
        );
      }
    } catch (error) {
      await interaction.followUp(`${EMOJIS.ERROR} Ocorreu um erro ao buscar a música.`);
      return;
    }
  },
};

export default playCommand;
