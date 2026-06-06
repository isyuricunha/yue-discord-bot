import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';
import { safe_reply_ephemeral } from '../../utils/interaction';
import { with_serializable_retry } from '../../utils/prisma-transaction';

export const prestigeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('prestige')
    .setNameLocalizations({ 'pt-BR': 'prestigio' })
    .setDescription('Troque seus níveis por pontos de prestígio no servidor')
    .setDescriptionLocalizations({ 'pt-BR': 'Troque seus níveis por pontos de prestígio no servidor' }),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
      });
      return;
    }

    const { user, guild } = interaction;
    const PRESTIGE_COST_LEVEL = 100; // Define minimum level to prestige

    try {
      const result = await with_serializable_retry(async (transaction) => {
        const entry = await transaction.guildXpMember.findUnique({
          where: {
            userId_guildId: {
              userId: user.id,
              guildId: guild.id,
            },
          },
        });

        if (!entry || entry.level < PRESTIGE_COST_LEVEL) {
          return {
            success: false as const,
            current_level: entry?.level ?? 0,
          };
        }

        const updated = await transaction.guildXpMember.update({
          where: { id: entry.id },
          data: {
            xp: 0,
            level: 0,
            prestige: { increment: 1 },
          },
          select: {
            prestige: true,
          },
        });

        return {
          success: true as const,
          prestige: updated.prestige,
        };
      });

      if (!result.success) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Você precisa estar no mínimo no nível **${PRESTIGE_COST_LEVEL}** para usar o Prestígio. (Nível Atual: **${result.current_level}**)`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`🌟 Prestígio Alcançado!`)
        .setDescription(`Você sacrificou todo seu XP Local no servidor e alcançou o nível de prestígio **${result.prestige}**! Seus níveis começaram de novo, mas suas bordas no perfil ficarão impressionantes.`)
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
       await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Ocorreu um erro ao realizar seu prestígio! Tente novamente.`,
      });
    }
  },
};
