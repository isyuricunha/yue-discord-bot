import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { moderationLogService } from '../../services/moderationLog.service';
import type { Command } from '../index';

export const kickCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setNameLocalizations({ 'pt-BR': 'expulsar' })
    .setDescription('Expulsar um usuário do servidor')
    .setDescriptionLocalizations({ 'pt-BR': 'Expulsar um usuário do servidor' })
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuário a ser expulso')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('razao')
        .setDescription('Razão da expulsão')
        .setRequired(false)
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
    const reason = interaction.options.get('razao')?.value as string | undefined;

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você não pode expulsar a si mesmo!`,
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === interaction.client.user?.id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você não pode me expulsar!`,
        ephemeral: true,
      });
      return;
    }

    try {
      const targetMember = await interaction.guild.members.fetch(targetUser.id);

      if (!targetMember) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} Usuário não encontrado no servidor!`,
          ephemeral: true,
        });
        return;
      }

      // Verificar hierarquia de roles
      const memberPosition = (interaction.member as any).roles.highest.position;
      const targetPosition = targetMember.roles.highest.position;

      if (targetPosition >= memberPosition) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} Você não pode expulsar este usuário pois ele tem uma role igual ou superior à sua!`,
          ephemeral: true,
        });
        return;
      }

      // Tentar enviar DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(COLORS.KICK)
          .setTitle(`${EMOJIS.KICK} Você foi expulso!`)
          .setDescription(`Você foi expulso do servidor **${interaction.guild.name}**`)
          .addFields([
            { name: 'Moderador', value: interaction.user.tag, inline: true },
            { name: 'Razão', value: reason || 'Não especificada', inline: true },
          ])
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.debug(`Não foi possível enviar DM para ${targetUser.tag}`);
      }

      // Expulsar usuário
      await targetMember.kick(reason || 'Não especificada');

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
          action: 'kick',
          reason: reason || 'Não especificada',
        },
      });

      await moderationLogService.notify({
        guild: interaction.guild,
        user: targetUser,
        staff: interaction.user,
        punishment: 'kick',
        reason: reason || 'Não especificada',
        duration: '',
      });

      const successEmbed = new EmbedBuilder()
        .setColor(COLORS.KICK)
        .setTitle(`${EMOJIS.KICK} Usuário Expulso`)
        .setDescription(`**${targetUser.tag}** foi expulso do servidor.`)
        .addFields([
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: true },
          { name: 'Razão', value: reason || 'Não especificada', inline: false },
        ])
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed] });

      logger.info(
        `Kick: ${targetUser.tag} (${targetUser.id}) expulso por ${interaction.user.tag} em ${interaction.guild.name}`
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao expulsar usuário');
      await interaction.reply({
        content: `${EMOJIS.ERROR} Erro ao expulsar o usuário. Verifique se tenho permissões suficientes.`,
        ephemeral: true,
      });
    }
  },
};
