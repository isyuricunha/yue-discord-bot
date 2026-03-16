import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';

function truncate_text(text: string, max_length: number): string {
  if (text.length <= max_length) return text;
  if (max_length <= 1) return text.slice(0, max_length);
  return `${text.slice(0, max_length - 1)}…`;
}

function is_http_url(value: string | undefined | null): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function format_user_mention(requester: unknown): string {
  const id = (requester as { id?: unknown } | null)?.id;
  return typeof id === 'string' && id.length ? `<@${id}>` : 'desconhecido';
}

function format_track_link(track: { title?: string; uri?: string }): string {
  const title_raw = typeof track.title === 'string' ? track.title : 'Sem título';
  const title = truncate_text(title_raw, 120);
  if (is_http_url(track.uri)) return `[${title}](${track.uri})`;
  return title;
}

export async function reply_with_queue_embed(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) return;

  if (!musicService) return;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }

  const player = musicService.kazagumo.players.get(interaction.guildId);

  if (!player || !player.playing) {
    await interaction.editReply({
      content: `${EMOJIS.ERROR} Não há nenhuma música tocando no momento.`,
    });
    return;
  }

  const currentTrack = player.queue.current;
  if (!currentTrack) return;

  const queue = player.queue;
  const isPaused = player.paused;
  const authorAvatar = interaction.client.user?.displayAvatarURL() || '';

  const current_description = truncate_text(
    `**Tocando agora:**\n${format_track_link(currentTrack)} \`[${formatTime(currentTrack.length)}]\` ${isPaused ? '⏸️' : '▶️'}\nPedida por: ${format_user_mention(currentTrack.requester)}`,
    4096
  );

  const embed = new EmbedBuilder()
    .setColor('#ff6a00')
    .setAuthor({
      name: 'Fila de Músicas da Yue',
      ...(authorAvatar ? { iconURL: authorAvatar } : null),
    })
    .setDescription(current_description);

  if (queue.length > 0) {
    const upcoming_lines: string[] = [];
    let used = 0;

    for (const [i, track] of queue.slice(0, 10).entries()) {
      const line_raw = `**${i + 1}.** ${format_track_link(track)} \`[${formatTime(track.length)}]\` - ${format_user_mention(track.requester)}`;
      const line = truncate_text(line_raw, 240);

      const next_used = used + line.length + (upcoming_lines.length ? 1 : 0);
      if (next_used > 1024) break;

      upcoming_lines.push(line);
      used = next_used;
    }

    embed.addFields({
      name: `Próximas na Fila (${queue.length})`,
      value: upcoming_lines.length ? upcoming_lines.join('\n') : '*Muitas músicas para listar aqui.*',
    });
  } else {
    embed.addFields({
      name: 'Próximas na Fila',
      value: '*A fila está vazia. Adicione mais músicas usando `/play`!*',
    });
  }

  if (queue.length > 10) {
    embed.setFooter({ text: `E mais ${queue.length - 10} músicas não listadas...` });
  }

  await interaction.editReply({ embeds: [embed] });
}

const queueCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Mostra a atual fila de músicas e o que está tocando agora'),

  async execute(interaction) {
    await reply_with_queue_embed(interaction);
  },
};

function formatTime(ms: number | undefined): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default queueCommand;
