import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';

export const prestigeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('prestige')
    .setNameLocalizations({ 'pt-BR': 'prestigio' })
    .setDescription('Troque seus níveis por pontos de prestígio no servidor')
    .setDescriptionLocalizations({ 'pt-BR': 'Troque seus níveis por pontos de prestígio no servidor' }),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
        ephemeral: true,
      });
      return;
    }

    const { user, guild } = interaction;
    const PRESTIGE_COST_LEVEL = 100; // Define minimum level to prestige

    const entry = await prisma.guildXpMember.findUnique({
      where: {
        userId_guildId: {
          userId: user.id,
          guildId: guild.id,
        },
      },
    });

    if (!entry || entry.level < PRESTIGE_COST_LEVEL) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você precisa estar no mínimo no nível **${PRESTIGE_COST_LEVEL}** para usar o Prestígio. (Nível Atual: **${entry?.level ?? 0}**)`,
        ephemeral: true,
      });
      return;
    }

    try {
      // Prestígio resetará o Nível e XP (exceto global) iterando o valor de prestige em database
      await prisma.guildXpMember.update({
        where: { id: entry.id },
        data: {
          xp: 0,
          level: 0,
          prestige: { increment: 1 },
        },
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`🌟 Prestígio Alcançado!`)
        .setDescription(`Você sacrificou todo seu XP Local no servidor e alcançou o nível de prestígio **${entry.prestige + 1}**! Seus níveis começaram de novo, mas suas bordas no perfil ficarão impressionantes.`)
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
       await interaction.reply({
        content: `${EMOJIS.ERROR} Ocorreu um erro ao realizar seu prestígio! Tente novamente.`,
        ephemeral: true,
      });
    }
  },
};
