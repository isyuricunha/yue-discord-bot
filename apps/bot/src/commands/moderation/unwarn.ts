import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { prisma } from '@yuebot/database';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { moderationLogService } from '../../services/moderationLog.service';
import type { Command } from '../index';

export const unwarnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setNameLocalizations({ 'pt-BR': 'remover-aviso' })
    .setDescription('Remover avisos de um usuário')
    .setDescriptionLocalizations({ 'pt-BR': 'Remover avisos de um usuário' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuário para remover avisos')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('quantidade')
        .setDescription('Quantidade de avisos para remover (deixe vazio para remover todos)')
        .setRequired(false)
        .setMinValue(1)
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
    const quantity = interaction.options.getInteger('quantidade');

    try {
      await interaction.deferReply({ ephemeral: true });

      // Buscar membro no banco
      const member = await prisma.guildMember.findUnique({
        where: {
          userId_guildId: {
            userId: targetUser.id,
            guildId: interaction.guildId,
          },
        },
      });

      if (!member) {
        await interaction.editReply({
          content: `${EMOJIS.INFO} ${targetUser.tag} não possui avisos!`,
        });
        return;
      }

      if (member.warnings === 0) {
        await interaction.editReply({
          content: `${EMOJIS.INFO} ${targetUser.tag} não possui avisos!`,
        });
        return;
      }

      const previousWarnings = member.warnings;
      let newWarnings: number;

      if (quantity) {
        // Remover quantidade específica
        newWarnings = Math.max(0, member.warnings - quantity);
      } else {
        // Remover todos
        newWarnings = 0;
      }

      // Atualizar warnings
      await prisma.guildMember.update({
        where: {
          userId_guildId: {
            userId: targetUser.id,
            guildId: interaction.guildId,
          },
        },
        data: {
          warnings: newWarnings,
        },
      });

      // Registrar no modlog
      await prisma.modLog.create({
        data: {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          moderatorId: interaction.user.id,
          action: 'unwarn',
          reason: quantity 
            ? `Removidos ${previousWarnings - newWarnings} aviso(s)` 
            : 'Todos os avisos removidos',
        },
      });

      await moderationLogService.notify({
        guild: interaction.guild,
        user: targetUser,
        staff: interaction.user,
        punishment: 'unwarn',
        reason: quantity ? `Removidos ${previousWarnings - newWarnings} aviso(s)` : 'Todos os avisos removidos',
        duration: '',
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Avisos Removidos`)
        .setDescription(`Avisos de ${targetUser.tag} foram atualizados`)
        .addFields([
          { name: 'Avisos Anteriores', value: previousWarnings.toString(), inline: true },
          { name: 'Avisos Removidos', value: (previousWarnings - newWarnings).toString(), inline: true },
          { name: 'Avisos Atuais', value: newWarnings.toString(), inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: false },
        ])
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(
        `Unwarn: ${interaction.user.tag} removeu ${previousWarnings - newWarnings} aviso(s) de ${targetUser.tag}`
      );

      // Tentar enviar DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Avisos Removidos`)
          .setDescription(`Alguns dos seus avisos foram removidos no servidor **${interaction.guild.name}**`)
          .addFields([
            { name: 'Moderador', value: interaction.user.tag, inline: true },
            { name: 'Avisos Removidos', value: (previousWarnings - newWarnings).toString(), inline: true },
            { name: 'Avisos Restantes', value: newWarnings.toString(), inline: true },
          ])
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.warn(`Não foi possível enviar DM para ${targetUser.tag}`);
      }

    } catch (error) {
      logger.error({ error }, 'Erro ao remover avisos');
      await interaction.editReply({
        content: `${EMOJIS.ERROR} Ocorreu um erro ao remover os avisos.`,
      });
    }
  },
};
