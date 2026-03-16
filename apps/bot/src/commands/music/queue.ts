import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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

const queue_page_size = 10;

function clamp_page(page: number, max_page: number): number {
  if (!Number.isFinite(page) || page < 0) return 0;
  if (page > max_page) return max_page;
  return page;
}

export function build_queue_embed_and_components(input: {
  player: { queue: any; paused: boolean };
  authorAvatar: string;
  page: number;
}): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const { player, authorAvatar } = input;

  const currentTrack = player.queue.current;
  if (!currentTrack) {
    const embed = new EmbedBuilder()
      .setColor('#ff6a00')
      .setAuthor({
        name: 'Fila de Músicas da Yue',
        ...(authorAvatar ? { iconURL: authorAvatar } : null),
      })
      .setDescription(`${EMOJIS.ERROR} Não há nenhuma música tocando no momento.`);

    return { embed, components: [] };
  }

  const queue = player.queue as any[];
  const isPaused = player.paused;

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

  const max_page = Math.max(0, Math.ceil(queue.length / queue_page_size) - 1);
  const page = clamp_page(input.page, max_page);

  if (queue.length > 0) {
    const start = page * queue_page_size;
    const page_items = queue.slice(start, start + queue_page_size);

    const upcoming_lines: string[] = [];
    let used = 0;

    for (const [idx, track] of page_items.entries()) {
      const absolute_index = start + idx;
      const line_raw = `**${absolute_index + 1}.** ${format_track_link(track)} \`[${formatTime(track.length)}]\` - ${format_user_mention(track.requester)}`;
      const line = truncate_text(line_raw, 240);

      const next_used = used + line.length + (upcoming_lines.length ? 1 : 0);
      if (next_used > 1024) break;

      upcoming_lines.push(line);
      used = next_used;
    }

    embed.addFields({
      name: `Próximas na Fila (${queue.length}) — Página ${page + 1}/${max_page + 1}`,
      value: upcoming_lines.length ? upcoming_lines.join('\n') : '*Muitas músicas para listar aqui.*',
    });
  } else {
    embed.addFields({
      name: 'Próximas na Fila',
      value: '*A fila está vazia. Adicione mais músicas usando `/play`!*',
    });
  }

  if (queue.length > queue_page_size) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`music:queue_page:${page - 1}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Anterior')
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`music:queue_page:${page + 1}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Próxima')
        .setDisabled(page >= max_page)
    );

    return { embed, components: [row] };
  }

  return { embed, components: [] };
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

  const authorAvatar = interaction.client.user?.displayAvatarURL() || '';

  const built = build_queue_embed_and_components({
    player: player as any,
    authorAvatar,
    page: 0,
  });

  await interaction.editReply({
    embeds: [built.embed],
    components: built.components,
  });
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
