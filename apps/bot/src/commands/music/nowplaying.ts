import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
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

function format_time(ms: number | undefined): string {
  if (!ms || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function build_controls_row(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('music:toggle_pause')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Pausar/Retomar'),
    new ButtonBuilder()
      .setCustomId('music:skip')
      .setStyle(ButtonStyle.Primary)
      .setLabel('Pular'),
    new ButtonBuilder()
      .setCustomId('music:stop')
      .setStyle(ButtonStyle.Danger)
      .setLabel('Parar'),
    new ButtonBuilder()
      .setCustomId('music:loop')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Loop')
  );
}

const nowplayingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Mostra a música que está tocando agora e o status do player'),

  async execute(interaction) {
    if (!interaction.guildId) return;
    if (!musicService) return;

    await interaction.deferReply();

    const player = musicService.kazagumo.players.get(interaction.guildId);
    if (!player || !player.playing) {
      await interaction.editReply({
        content: `${EMOJIS.ERROR} Não há nenhuma música tocando no momento.`,
      });
      return;
    }

    const current = player.queue.current;
    if (!current) {
      await interaction.editReply({
        content: `${EMOJIS.ERROR} Não há nenhuma música tocando no momento.`,
      });
      return;
    }

    const title_raw = typeof current.title === 'string' ? current.title : 'Sem título';
    const title = truncate_text(title_raw, 240);

    const uri = typeof current.uri === 'string' ? current.uri : '';
    const title_display = is_http_url(uri) ? `[${title}](${uri})` : title;

    const duration = typeof current.length === 'number' ? current.length : 0;
    const position = typeof player.position === 'number' ? player.position : 0;

    const isPaused = player.paused;
    const status = isPaused ? '⏸️ pausado' : '▶️ tocando';

    const volume = typeof player.volume === 'number' ? player.volume : 70;
    const loop = typeof player.loop === 'string' ? player.loop : 'none';
    const loop_label = loop === 'track' ? 'faixa' : loop === 'queue' ? 'fila' : 'desligado';

    const description = truncate_text(
      `${title_display}\n\n` +
        `**Status:** ${status}\n` +
        `**Tempo:** ${format_time(position)} / ${format_time(duration)}\n` +
        `**Volume:** ${volume}%\n` +
        `**Loop:** ${loop_label}\n` +
        `**Pedido por:** ${format_user_mention(current.requester)}`,
      4096
    );

    const embed = new EmbedBuilder()
      .setColor('#ff6a00')
      .setTitle('Tocando agora')
      .setDescription(description);

    const thumb = (current as { thumbnail?: unknown }).thumbnail;
    if (typeof thumb === 'string' && is_http_url(thumb)) {
      embed.setThumbnail(thumb);
    }

    const upcoming = player.queue.slice(0, 5);
    if (upcoming.length) {
      const lines = upcoming.map((t, idx) => {
        const t_title_raw = typeof t.title === 'string' ? t.title : 'Sem título';
        const t_title = truncate_text(t_title_raw, 120);
        const t_uri = typeof t.uri === 'string' ? t.uri : '';
        const t_display = is_http_url(t_uri) ? `[${t_title}](${t_uri})` : t_title;
        const t_len = typeof t.length === 'number' ? t.length : 0;
        return `**${idx + 1}.** ${t_display} \`[${format_time(t_len)}]\``;
      });

      embed.addFields({
        name: `Próximas (${player.queue.length})`,
        value: truncate_text(lines.join('\n'), 1024),
      });
    } else {
      embed.addFields({
        name: 'Próximas',
        value: '*A fila está vazia.*',
      });
    }

    await interaction.editReply({
      embeds: [embed],
      components: [build_controls_row()],
    });
  },
};

export default nowplayingCommand;
