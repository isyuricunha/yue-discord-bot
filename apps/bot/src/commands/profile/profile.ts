import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'
import type { Command } from '../index'

export const profileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setNameLocalizations({ 'pt-BR': 'perfil' })
    .setDescription('Ver perfil de um usuário')
    .setDescriptionLocalizations({ 'pt-BR': 'Ver perfil de um usuário' })
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setNameLocalizations({ 'pt-BR': 'usuario' })
        .setDescription('Usuário para consultar (padrão: você)')
        .setDescriptionLocalizations({ 'pt-BR': 'Usuário para consultar (padrão: você)' })
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('usuario') ?? interaction.user

    const user = await prisma.user.upsert({
      where: { id: target.id },
      update: {
        username: target.username,
        avatar: target.displayAvatarURL(),
      },
      create: {
        id: target.id,
        username: target.username,
        avatar: target.displayAvatarURL(),
      },
      include: {
        profile: true,
        badges: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: { badge: true },
          orderBy: { grantedAt: 'desc' },
        },
      },
    })

    const visible_badges = user.badges.filter((ub) => ub.badge.hidden !== true)

    const badge_text =
      visible_badges.length > 0
        ? visible_badges
            .map((ub) => ub.badge.icon ? `${ub.badge.icon} ${ub.badge.name}` : ub.badge.name)
            .join('\n')
        : '—'

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} Perfil`)
      .setDescription(`**${target.username}**`)
      .setThumbnail(target.displayAvatarURL())
      .addFields([
        { name: 'Bio', value: user.profile?.bio?.trim() ? user.profile.bio : '—', inline: false },
        { name: 'Badges', value: badge_text, inline: false },
      ])
      .setTimestamp()

    await interaction.reply({ embeds: [embed] })
  },
}
