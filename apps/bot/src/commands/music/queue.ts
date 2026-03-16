import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { musicService } from '../../services/music.service';

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

  const embed = new EmbedBuilder()
    .setColor('#ff6a00')
    .setAuthor({
      name: 'Fila de Músicas da Yue',
      ...(authorAvatar ? { iconURL: authorAvatar } : null),
    })
    .setDescription(
      `**Tocando agora:**\n[${currentTrack.title}](${currentTrack.uri}) \`[${formatTime(currentTrack.length)}]\` ${isPaused ? '⏸️' : '▶️'}\nPedida por: <@${(currentTrack.requester as { id: string })?.id}>`
    );

  if (queue.length > 0) {
    const upcoming = queue.slice(0, 10).map((track, i) => {
      return `**${i + 1}.** [${track.title}](${track.uri}) \`[${formatTime(track.length)}]\` - <@${(track.requester as { id: string })?.id}>`;
    });

    embed.addFields({
      name: `Próximas na Fila (${queue.length})`,
      value: upcoming.join('\n'),
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
