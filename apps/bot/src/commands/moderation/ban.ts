import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { moderationLogService } from '../../services/moderationLog.service';
import type { Command } from '../index';

export const banCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setNameLocalizations({ 'pt-BR': 'banir' })
    .setDescription('Banir um usuário do servidor')
    .setDescriptionLocalizations({ 'pt-BR': 'Banir um usuário do servidor' })
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuário a ser banido')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('razao')
        .setDescription('Razão do banimento')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('deletar_mensagens')
        .setDescription('Deletar mensagens dos últimos X dias (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
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
    const deleteMessageDays = (interaction.options.get('deletar_mensagens')?.value as number) || 0;

    // Verificar se o usuário está tentando banir a si mesmo
    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você não pode banir a si mesmo!`,
        ephemeral: true,
      });
      return;
    }

    // Verificar se o usuário está tentando banir o bot
    if (targetUser.id === interaction.client.user?.id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você não pode me banir!`,
        ephemeral: true,
      });
      return;
    }

    try {
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      // Verificar hierarquia de roles
      if (targetMember) {
        const memberPosition = (interaction.member as any).roles.highest.position;
        const targetPosition = targetMember.roles.highest.position;

        if (targetPosition >= memberPosition) {
          await interaction.reply({
            content: `${EMOJIS.ERROR} Você não pode banir este usuário pois ele tem uma role igual ou superior à sua!`,
            ephemeral: true,
          });
          return;
        }
      }

      // Tentar enviar DM para o usuário
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(COLORS.BAN)
          .setTitle(`${EMOJIS.BAN} Você foi banido!`)
          .setDescription(`Você foi banido do servidor **${interaction.guild.name}**`)
          .addFields([
            { name: 'Moderador', value: interaction.user.tag, inline: true },
            { name: 'Razão', value: reason || 'Não especificada', inline: true },
          ])
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        // Ignorar se não conseguir enviar DM
        logger.debug(`Não foi possível enviar DM para ${targetUser.tag}`);
      }

      // Banir usuário
      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: deleteMessageDays * 86400,
        reason: reason || 'Não especificada',
      });

      // Registrar no banco de dados
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
          joinedAt: new Date(),
        },
      });

      await prisma.modLog.create({
        data: {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          moderatorId: interaction.user.id,
          action: 'ban',
          reason: reason || 'Não especificada',
          metadata: { deleteMessageDays },
        },
      });

      await moderationLogService.notify({
        guild: interaction.guild,
        user: targetUser,
        staff: interaction.user,
        punishment: 'ban',
        reason: reason || 'Não especificada',
        duration: '',
      });

      // Embed de sucesso
      const successEmbed = new EmbedBuilder()
        .setColor(COLORS.BAN)
        .setTitle(`${EMOJIS.BAN} Usuário Banido`)
        .setDescription(`**${targetUser.tag}** foi banido do servidor.`)
        .addFields([
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: true },
          { name: 'Razão', value: reason || 'Não especificada', inline: false },
        ])
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      if (deleteMessageDays > 0) {
        successEmbed.addFields([
          { name: 'Mensagens Deletadas', value: `Últimos ${deleteMessageDays} dia(s)`, inline: true },
        ]);
      }

      await interaction.reply({ embeds: [successEmbed] });

      logger.info(
        `Ban: ${targetUser.tag} (${targetUser.id}) banido por ${interaction.user.tag} em ${interaction.guild.name}`
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao banir usuário');
      await interaction.reply({
        content: `${EMOJIS.ERROR} Erro ao banir o usuário. Verifique se tenho permissões suficientes.`,
        ephemeral: true,
      });
    }
  },
};
