import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';

export const modlogCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Ver histórico de punições de um usuário')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuário para ver o histórico')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('tipo')
        .setDescription('Filtrar por tipo de ação')
        .setRequired(false)
        .addChoices(
          { name: 'Ban', value: 'ban' },
          { name: 'Kick', value: 'kick' },
          { name: 'Warn', value: 'warn' },
          { name: 'Mute', value: 'mute' },
          { name: 'Unmute', value: 'unmute' },
        )
    )
    .addIntegerOption(option =>
      option
        .setName('limite')
        .setDescription('Número de registros a exibir (padrão: 10)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('usuario', true);
    const actionType = interaction.options.get('tipo')?.value as string | undefined;
    const limit = (interaction.options.get('limite')?.value as number) || 10;

    try {
      // Buscar membro
      const member = await prisma.guildMember.findUnique({
        where: {
          userId_guildId: {
            userId: targetUser.id,
            guildId: interaction.guild.id,
          },
        },
      });

      // Buscar logs
      const logs = await prisma.modLog.findMany({
        where: {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          ...(actionType && { action: actionType }),
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      if (logs.length === 0) {
        await interaction.reply({
          content: `${EMOJIS.INFO} Nenhum registro encontrado para ${targetUser.tag}.`,
          ephemeral: true,
        });
        return;
      }

      // Criar embed
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`📋 Histórico de Moderação`)
        .setDescription(`Usuário: **${targetUser.tag}**`)
        .setThumbnail(targetUser.displayAvatarURL());

      if (member) {
        embed.addFields([
          { name: 'Warns Ativos', value: member.warnings.toString(), inline: true },
        ]);
      }

      // Adicionar logs
      const actionEmojis: Record<string, string> = {
        ban: EMOJIS.BAN,
        kick: EMOJIS.KICK,
        warn: EMOJIS.WARNING,
        mute: EMOJIS.MUTE,
        unmute: '🔊',
      };

      const actionColors: Record<string, string> = {
        ban: '🔴',
        kick: '🟠',
        warn: '🟡',
        mute: '⚫',
        unmute: '🟢',
      };

      for (const log of logs) {
        const moderator = await interaction.client.users.fetch(log.moderatorId).catch(() => null);
        const emoji = actionEmojis[log.action] || '•';
        const date = log.createdAt.toLocaleDateString('pt-BR');
        const time = log.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let value = `**Moderador:** ${moderator?.tag || log.moderatorId}\n`;
        value += `**Razão:** ${log.reason || 'Não especificada'}\n`;
        if (log.duration) {
          value += `**Duração:** ${log.duration}\n`;
        }
        value += `**Data:** ${date} às ${time}`;

        embed.addFields([
          { 
            name: `${emoji} ${log.action.toUpperCase()}`, 
            value: value, 
            inline: false 
          },
        ]);
      }

      embed.setFooter({ 
        text: `Total de registros: ${logs.length}${logs.length >= limit ? ' (limitado)' : ''}` 
      });
      embed.setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`ModLog consultado por ${interaction.user.tag} para ${targetUser.tag}`);
    } catch (error) {
      logger.error({ error }, 'Erro ao buscar modlog');
      await interaction.reply({
        content: `${EMOJIS.ERROR} Erro ao buscar histórico de moderação.`,
        ephemeral: true,
      });
    }
  },
};
