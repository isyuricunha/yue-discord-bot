import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { logger } from '../../utils/logger';
import { COLORS, discord_timeout_max_ms, EMOJIS, parseDurationMs } from '@yuebot/shared';
import { moderationLogService } from '../../services/moderationLog.service';
import type { Command } from '../index';

function formatDuration(duration: string): string {
  const match = duration.match(/^(\d+)([smhdw])$/);
  if (!match) return duration;

  const value = match[1];
  const unit = match[2];

  const units: Record<string, string> = {
    's': 'segundo(s)',
    'm': 'minuto(s)',
    'h': 'hora(s)',
    'd': 'dia(s)',
    'w': 'semana(s)',
  };

  return `${value} ${units[unit]}`;
}

export const muteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setNameLocalizations({ 'pt-BR': 'silenciar' })
    .setDescription('Silenciar um usuário temporariamente')
    .setDescriptionLocalizations({ 'pt-BR': 'Silenciar um usuário temporariamente' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuário a ser silenciado')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duracao')
        .setDescription('Duração do silenciamento (ex: 5m, 2h, 1d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('razao')
        .setDescription('Razão do silenciamento')
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
    const duration = interaction.options.get('duracao')?.value as string;
    const reason = interaction.options.get('razao')?.value as string | undefined;

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você não pode silenciar a si mesmo!`,
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === interaction.client.user?.id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você não pode me silenciar!`,
        ephemeral: true,
      });
      return;
    }

    // Validar duração
    const durationMs = parseDurationMs(duration, { maxMs: discord_timeout_max_ms, clampToMax: false });
    if (!durationMs) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Duração inválida! Use o formato: 5m, 2h, 1d, 1w (m=minutos, h=horas, d=dias, w=semanas)`,
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

      // Verificar hierarquia
      const memberPosition = (interaction.member as any).roles.highest.position;
      const targetPosition = targetMember.roles.highest.position;

      if (targetPosition >= memberPosition) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} Você não pode silenciar este usuário pois ele tem uma role igual ou superior à sua!`,
          ephemeral: true,
        });
        return;
      }

      // Tentar enviar DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(COLORS.MUTE)
          .setTitle(`${EMOJIS.MUTE} Você foi silenciado!`)
          .setDescription(`Você foi silenciado no servidor **${interaction.guild.name}**`)
          .addFields([
            { name: 'Moderador', value: interaction.user.tag, inline: true },
            { name: 'Duração', value: formatDuration(duration), inline: true },
            { name: 'Razão', value: reason || 'Não especificada', inline: false },
          ])
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.debug(`Não foi possível enviar DM para ${targetUser.tag}`);
      }

      // Aplicar timeout
      await targetMember.timeout(durationMs, reason || 'Não especificada');

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
          action: 'mute',
          reason: reason || 'Não especificada',
          duration: duration,
        },
      });

      await moderationLogService.notify({
        guild: interaction.guild,
        user: targetUser,
        staff: interaction.user,
        punishment: 'mute',
        reason: reason || 'Não especificada',
        duration,
      });

      const successEmbed = new EmbedBuilder()
        .setColor(COLORS.MUTE)
        .setTitle(`${EMOJIS.MUTE} Usuário Silenciado`)
        .setDescription(`**${targetUser.tag}** foi silenciado.`)
        .addFields([
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: true },
          { name: 'Duração', value: formatDuration(duration), inline: true },
          { name: 'Razão', value: reason || 'Não especificada', inline: false },
        ])
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed] });

      logger.info(
        `Mute: ${targetUser.tag} (${targetUser.id}) silenciado por ${interaction.user.tag} por ${duration}`
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao silenciar usuário');
      await interaction.reply({
        content: `${EMOJIS.ERROR} Erro ao silenciar o usuário. Verifique se tenho permissões suficientes.`,
        ephemeral: true,
      });
    }
  },
};
