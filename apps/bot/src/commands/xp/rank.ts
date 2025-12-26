import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';

function level_from_xp(xp: number) {
  return Math.floor(xp / 1000);
}

function xp_to_next_level(xp: number) {
  const remainder = xp % 1000;
  return 1000 - remainder;
}

export const rankCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setNameLocalizations({ 'pt-BR': 'rank' })
    .setDescription('Ver o rank de XP no servidor')
    .setDescriptionLocalizations({ 'pt-BR': 'Ver o rank de XP no servidor' })
    .addBooleanOption((option) =>
      option
        .setName('global')
        .setNameLocalizations({ 'pt-BR': 'global' })
        .setDescription('Mostrar XP global (somando todos os servidores)')
        .setDescriptionLocalizations({ 'pt-BR': 'Mostrar XP global (somando todos os servidores)' })
        .setRequired(false)
    )
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setNameLocalizations({ 'pt-BR': 'usuario' })
        .setDescription('Usuário para consultar (padrão: você)')
        .setDescriptionLocalizations({ 'pt-BR': 'Usuário para consultar (padrão: você)' })
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

    const target = interaction.options.getUser('usuario') ?? interaction.user;
    const is_global = interaction.options.getBoolean('global') ?? false;

    if (is_global) {
      const entry = await prisma.globalXpMember.findUnique({
        where: { userId: target.id },
      });

      const xp = entry?.xp ?? 0;
      const level = entry?.level ?? level_from_xp(xp);

      const above = entry
        ? await prisma.globalXpMember.count({
            where: {
              xp: { gt: xp },
            },
          })
        : null;

      const position = above === null ? null : above + 1;

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Rank Global de Experiência`)
        .setDescription(`**${target.username}**`)
        .addFields([
          { name: 'Nível atual', value: String(level), inline: true },
          { name: 'XP atual', value: String(xp), inline: true },
          { name: 'Colocação', value: position ? `#${position}` : '—', inline: true },
          { name: `XP necessário para o próximo nível (${level + 1})`, value: String(xp_to_next_level(xp)), inline: false },
        ])
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const entry = await prisma.guildXpMember.findUnique({
      where: {
        userId_guildId: {
          userId: target.id,
          guildId: interaction.guild.id,
        },
      },
    });

    const xp = entry?.xp ?? 0;
    const level = entry?.level ?? level_from_xp(xp);

    const above = entry
      ? await prisma.guildXpMember.count({
          where: {
            guildId: interaction.guild.id,
            xp: { gt: xp },
          },
        })
      : null;

    const position = above === null ? null : above + 1;

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} Rank de Experiência`)
      .setDescription(`**${target.username}**`) 
      .addFields([
        { name: 'Nível atual', value: String(level), inline: true },
        { name: 'XP atual', value: String(xp), inline: true },
        { name: 'Colocação', value: position ? `#${position}` : '—', inline: true },
        { name: `XP necessário para o próximo nível (${level + 1})`, value: String(xp_to_next_level(xp)), inline: false },
      ])
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
