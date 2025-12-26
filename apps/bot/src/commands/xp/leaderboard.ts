import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';

function format_line(position: number, username: string, level: number, xp: number) {
  return `**#${position}** ${username} — Nível **${level}** (${xp} XP)`;
}

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setNameLocalizations({ 'pt-BR': 'leaderboard' })
    .setDescription('Ver o top de XP do servidor')
    .setDescriptionLocalizations({ 'pt-BR': 'Ver o top de XP do servidor' })
    .addBooleanOption((option) =>
      option
        .setName('global')
        .setNameLocalizations({ 'pt-BR': 'global' })
        .setDescription('Mostrar leaderboard global (somando todos os servidores)')
        .setDescriptionLocalizations({ 'pt-BR': 'Mostrar leaderboard global (somando todos os servidores)' })
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setNameLocalizations({ 'pt-BR': 'limite' })
        .setDescription('Quantidade de usuários a mostrar (1-25)')
        .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de usuários a mostrar (1-25)' })
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

    const is_global = interaction.options.getBoolean('global') ?? false;
    const limit = interaction.options.getInteger('limite') ?? 10;

    if (is_global) {
      const rows = await prisma.globalXpMember.findMany({
        orderBy: [{ xp: 'desc' }, { updatedAt: 'asc' }],
        take: limit,
      });

      if (rows.length === 0) {
        await interaction.reply({
          content: `${EMOJIS.INFO} Ainda não há dados de XP global.`,
          ephemeral: true,
        });
        return;
      }

      const lines = rows.map((row, idx) => format_line(idx + 1, row.username, row.level, row.xp));

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.TROPHY} Leaderboard Global de XP`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Mostrando top ${rows.length}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const rows = await prisma.guildXpMember.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: [{ xp: 'desc' }, { updatedAt: 'asc' }],
      take: limit,
    });

    if (rows.length === 0) {
      await interaction.reply({
        content: `${EMOJIS.INFO} Ainda não há dados de XP neste servidor.`,
        ephemeral: true,
      });
      return;
    }

    const ids = rows.map((r) => r.userId);
    const members = await prisma.guildMember.findMany({
      where: {
        guildId: interaction.guild.id,
        userId: { in: ids },
      },
      select: {
        userId: true,
        username: true,
      },
    });

    const username_by_id = new Map(members.map((m) => [m.userId, m.username]));

    const missing = ids.filter((id) => !username_by_id.has(id));
    if (missing.length > 0) {
      const fetched = await Promise.all(
        missing.map(async (id) => {
          const user = await interaction.client.users.fetch(id).catch(() => null);
          return user ? { id: user.id, username: user.username } : null;
        })
      );

      for (const item of fetched) {
        if (!item) continue;
        username_by_id.set(item.id, item.username);
      }
    }

    const lines = rows.map((row, idx) =>
      format_line(idx + 1, username_by_id.get(row.userId) ?? row.userId, row.level, row.xp)
    );

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.TROPHY} Leaderboard de XP`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Mostrando top ${rows.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
