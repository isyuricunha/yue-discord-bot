import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { GuildMember } from 'discord.js';
import { prisma } from '@yuebot/database';
import { WarnService } from '../../services/warnService';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { moderationLogService } from '../../services/moderationLog.service';
import type { Command } from '../index';

function is_guild_member(member: ChatInputCommandInteraction['member']): member is GuildMember {
  if (!member) return false;

  const roles = (member as { roles?: unknown }).roles;
  return roles !== undefined && !Array.isArray(roles);
}

export const warnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setNameLocalizations({ 'pt-BR': 'avisar' })
    .setDescription('Advertir um usuário')
    .setDescriptionLocalizations({ 'pt-BR': 'Advertir um usuário' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuário a ser advertido')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('razao')
        .setDescription('Razão da advertência')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('usuario', true);
    const reason = interaction.options.get('razao')?.value as string;

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você não pode advertir a si mesmo!`,
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === interaction.client.user?.id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você não pode me advertir!`,
        ephemeral: true,
      });
      return;
    }

    try {
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} Usuário não encontrado no servidor!`,
          ephemeral: true,
        });
        return;
      }

      // Verificar hierarquia
      const actorMember = is_guild_member(interaction.member)
        ? interaction.member
        : await interaction.guild.members.fetch(interaction.user.id);

      const memberPosition = actorMember.roles.highest.position;
      const targetPosition = targetMember.roles.highest.position;

      if (targetPosition >= memberPosition) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} Você não pode advertir este usuário pois ele tem uma role igual ou superior à sua!`,
          ephemeral: true,
        });
        return;
      }

      // Registrar warn no banco
      // Incrementar contador de warns
      const updatedMember = await prisma.guildMember.upsert({
        where: {
          userId_guildId: {
            userId: targetUser.id,
            guildId: interaction.guildId,
          },
        },
        update: {
          warnings: {
            increment: 1,
          },
          username: targetUser.username,
          avatar: targetUser.displayAvatarURL(),
        },
        create: {
          userId: targetUser.id,
          guildId: interaction.guildId,
          username: targetUser.username,
          avatar: targetUser.displayAvatarURL(),
          joinedAt: targetMember.joinedAt || new Date(),
          warnings: 1,
        },
      });

      await prisma.modLog.create({
        data: {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          moderatorId: interaction.user.id,
          action: 'warn',
          reason: reason,
        },
      });

      await moderationLogService.notify({
        guild: interaction.guild,
        user: targetUser,
        staff: interaction.user,
        punishment: 'warn',
        reason,
        duration: '',
      });

      const totalWarnings = updatedMember.warnings;

      // Verificar e aplicar thresholds automáticos
      const warnService = new WarnService(interaction.client);
      await warnService.checkAndApplyThresholds(
        interaction.guildId,
        targetUser.id,
        updatedMember.warnings
      );

      // Tentar enviar DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(COLORS.WARN)
          .setTitle(`${EMOJIS.WARNING} Você recebeu uma advertência!`)
          .setDescription(`Você foi advertido no servidor **${interaction.guild.name}**`)
          .addFields([
            { name: 'Moderador', value: interaction.user.tag, inline: true },
            { name: 'Total de Warns', value: totalWarnings.toString(), inline: true },
            { name: 'Razão', value: reason, inline: false },
          ])
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.debug(`Não foi possível enviar DM para ${targetUser.tag}`);
      }

      const successEmbed = new EmbedBuilder()
        .setColor(COLORS.WARN)
        .setTitle(`${EMOJIS.WARNING} Usuário Advertido`)
        .setDescription(`**${targetUser.tag}** foi advertido.`)
        .addFields([
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: true },
          { name: 'Total de Warns', value: totalWarnings.toString(), inline: true },
          { name: 'Razão', value: reason, inline: false },
        ])
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed] });

      logger.info(
        `Warn: ${targetUser.tag} (${targetUser.id}) advertido por ${interaction.user.tag}. Total: ${totalWarnings}`
      );

      // TODO: Implementar ações automáticas baseadas em thresholds de warns
    } catch (error) {
      logger.error({ error }, 'Erro ao advertir usuário');
      await interaction.reply({
        content: `${EMOJIS.ERROR} Erro ao advertir o usuário.`,
        ephemeral: true,
      });
    }
  },
};
