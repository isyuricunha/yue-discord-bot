import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';

export const baninfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('baninfo')
    .setDescription('Ver informações sobre o banimento de um usuário')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option
        .setName('usuario_id')
        .setDescription('ID do usuário banido')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
        ephemeral: true,
      });
      return;
    }

    const userId = interaction.options.get('usuario_id')?.value as string;

    try {
      // Buscar ban
      const ban = await interaction.guild.bans.fetch(userId).catch(() => null);

      if (!ban) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} Usuário com ID \`${userId}\` não está banido neste servidor.`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.BAN)
        .setTitle(`${EMOJIS.BAN} Informações do Banimento`)
        .setDescription(`Usuário: **${ban.user.tag}**`)
        .addFields([
          { name: 'ID', value: ban.user.id, inline: true },
          { name: 'Username', value: ban.user.username, inline: true },
          { name: 'Razão', value: ban.reason || 'Não especificada', inline: false },
        ])
        .setThumbnail(ban.user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`BanInfo consultado por ${interaction.user.tag} para ${ban.user.tag}`);
    } catch (error) {
      logger.error({ error }, 'Erro ao buscar informações do ban');
      await interaction.reply({
        content: `${EMOJIS.ERROR} Erro ao buscar informações do banimento.`,
        ephemeral: true,
      });
    }
  },
};
