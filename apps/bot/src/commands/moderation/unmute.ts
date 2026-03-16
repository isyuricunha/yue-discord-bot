import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { moderationLogService } from '../../services/moderationLog.service';
import { safe_reply_ephemeral } from '../../utils/interaction';
import type { Command } from '../index';

export const unmuteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setNameLocalizations({ 'pt-BR': 'dessilenciar' })
    .setDescription('Remover o silenciamento de um usuário')
    .setDescriptionLocalizations({ 'pt-BR': 'Remover o silenciamento de um usuário' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuário a ser dessilenciado')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
      });
      return;
    }

    const targetUser = interaction.options.getUser('usuario', true);

    try {
      const targetMember = await interaction.guild.members.fetch(targetUser.id);

      if (!targetMember) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Usuário não encontrado no servidor!`,
        });
        return;
      }

      // Verificar se o usuário está silenciado
      if (!targetMember.communicationDisabledUntil) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Este usuário não está silenciado!`,
        });
        return;
      }

      // Remover timeout
      await targetMember.timeout(null);

      // Registrar no banco
      await prisma.guildMember.upsert({
        where: {
          userId_guildId: {
            userId: targetUser.id,
            guildId: interaction.guild.id,
          },
        },
        update: {},
        create: {
          userId: targetUser.id,
          guildId: interaction.guild.id,
          username: targetUser.username,
          avatar: targetUser.displayAvatarURL(),
          joinedAt: targetMember.joinedAt || new Date(),
        },
      });

      await prisma.modLog.create({
        data: {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          moderatorId: interaction.user.id,
          action: 'unmute',
          reason: 'Dessilenciado manualmente',
        },
      });

      await moderationLogService.notify({
        guild: interaction.guild,
        user: targetUser,
        staff: interaction.user,
        punishment: 'unmute',
        reason: 'Dessilenciado manualmente',
        duration: '',
      });

      const successEmbed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Usuário Dessilenciado`)
        .setDescription(`**${targetUser.tag}** foi dessilenciado.`)
        .addFields([
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: true },
        ])
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed] });

      logger.info(
        `Unmute: ${targetUser.tag} (${targetUser.id}) dessilenciado por ${interaction.user.tag}`
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao dessilenciar usuário');
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Erro ao dessilenciar o usuário. Verifique se tenho permissões suficientes.`,
      });
    }
  },
};
