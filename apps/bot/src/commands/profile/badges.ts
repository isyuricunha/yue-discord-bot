import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'
import { CONFIG } from '../../config'
import type { Command } from '../index'

function is_badge_admin(user_id: string): boolean {
  return CONFIG.admin.badgeAdminUserIds.includes(user_id)
}

export const badgesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('badges')
    .setDescription('Gerenciar e visualizar badges')
    .setDescriptionLocalizations({ 'pt-BR': 'Gerenciar e visualizar badges' })
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setNameLocalizations({ 'pt-BR': 'listar' })
        .setDescription('Listar badges de um usuário')
        .setDescriptionLocalizations({ 'pt-BR': 'Listar badges de um usuário' })
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Usuário para consultar (padrão: você)')
            .setDescriptionLocalizations({ 'pt-BR': 'Usuário para consultar (padrão: você)' })
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('grant')
        .setNameLocalizations({ 'pt-BR': 'conceder' })
        .setDescription('Conceder badge para um usuário (admin)')
        .setDescriptionLocalizations({ 'pt-BR': 'Conceder badge para um usuário (admin)' })
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Usuário que receberá a badge')
            .setDescriptionLocalizations({ 'pt-BR': 'Usuário que receberá a badge' })
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('badge')
            .setDescription('ID da badge')
            .setDescriptionLocalizations({ 'pt-BR': 'ID da badge' })
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('revoke')
        .setNameLocalizations({ 'pt-BR': 'remover' })
        .setDescription('Remover badge de um usuário (admin)')
        .setDescriptionLocalizations({ 'pt-BR': 'Remover badge de um usuário (admin)' })
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Usuário que perderá a badge')
            .setDescriptionLocalizations({ 'pt-BR': 'Usuário que perderá a badge' })
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('badge')
            .setDescription('ID da badge')
            .setDescriptionLocalizations({ 'pt-BR': 'ID da badge' })
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('holders')
        .setNameLocalizations({ 'pt-BR': 'holders' })
        .setDescription('Listar quem possui uma badge (admin)')
        .setDescriptionLocalizations({ 'pt-BR': 'Listar quem possui uma badge (admin)' })
        .addStringOption((option) =>
          option
            .setName('badge')
            .setDescription('ID da badge')
            .setDescriptionLocalizations({ 'pt-BR': 'ID da badge' })
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('limite')
            .setNameLocalizations({ 'pt-BR': 'limite' })
            .setDescription('Quantidade (1-25)')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantidade (1-25)' })
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName('offset')
            .setNameLocalizations({ 'pt-BR': 'offset' })
            .setDescription('Pular N resultados (paginação)')
            .setDescriptionLocalizations({ 'pt-BR': 'Pular N resultados (paginação)' })
            .setMinValue(0)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    if (sub === 'list') {
      const target = interaction.options.getUser('usuario') ?? interaction.user

      const user = await prisma.user.findUnique({
        where: { id: target.id },
        include: {
          badges: {
            where: {
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            include: { badge: true },
            orderBy: { grantedAt: 'desc' },
          },
        },
      })

      const visible = (user?.badges ?? []).filter((ub) => ub.badge.hidden !== true)

      const description =
        visible.length > 0
          ? visible.map((ub) => `${ub.badge.id} — ${ub.badge.icon ? `${ub.badge.icon} ` : ''}${ub.badge.name}`).join('\n')
          : '—'

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Badges`)
        .setDescription(`**${target.username}**\n\n${description}`)
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp()

      await interaction.reply({ embeds: [embed], ephemeral: true })
      return
    }

    if (sub === 'holders') {
      if (!is_badge_admin(interaction.user.id)) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Você não tem permissão para isso.`, ephemeral: true })
        return
      }

      await interaction.deferReply({ ephemeral: true })

      const badge_id = interaction.options.getString('badge', true)
      const limit = interaction.options.getInteger('limite') ?? 10
      const offset = interaction.options.getInteger('offset') ?? 0

      const badge = await prisma.badge.findUnique({ where: { id: badge_id } })
      if (!badge) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Badge não encontrada: ${badge_id}` })
        return
      }

      const rows = await prisma.userBadge.findMany({
        where: {
          badgeId: badge_id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { grantedAt: 'desc' },
        take: Math.min(limit, 25),
        skip: Math.max(offset, 0),
      })

      const total = await prisma.userBadge.count({
        where: {
          badgeId: badge_id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      })

      const lines =
        rows.length > 0
          ? rows.map((r, idx) => `**#${offset + idx + 1}** <@${r.userId}> — ${r.source}`).join('\n')
          : '—'

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Holders — ${badge.id}`)
        .setDescription(`${badge.icon ? `${badge.icon} ` : ''}${badge.name}\n\n${lines}`)
        .setFooter({ text: `Mostrando ${rows.length}/${total} (limit=${limit}, offset=${offset})` })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (!is_badge_admin(interaction.user.id)) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Você não tem permissão para isso.`, ephemeral: true })
      return
    }

    const target = interaction.options.getUser('usuario', true)
    const badge_id = interaction.options.getString('badge', true)

    const badge = await prisma.badge.findUnique({ where: { id: badge_id } })
    if (!badge) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Badge não encontrada: ${badge_id}`, ephemeral: true })
      return
    }

    await prisma.user.upsert({
      where: { id: target.id },
      update: { username: target.username, avatar: target.displayAvatarURL() },
      create: { id: target.id, username: target.username, avatar: target.displayAvatarURL() },
    })

    if (sub === 'grant') {
      await prisma.userBadge.upsert({
        where: {
          userId_badgeId: {
            userId: target.id,
            badgeId: badge_id,
          },
        },
        update: {
          source: 'manual',
          expiresAt: null,
          metadata: null,
        },
        create: {
          userId: target.id,
          badgeId: badge_id,
          source: 'manual',
          expiresAt: null,
          metadata: null,
        },
      })

      await interaction.reply({ content: `${EMOJIS.SUCCESS} Badge **${badge.name}** concedida para **${target.username}**.`, ephemeral: true })
      return
    }

    if (sub === 'revoke') {
      await prisma.userBadge.delete({
        where: {
          userId_badgeId: {
            userId: target.id,
            badgeId: badge_id,
          },
        },
      }).catch((err: unknown) => {
        const prisma_error = err as { code?: unknown }
        if (prisma_error.code === 'P2025') return null
        throw err
      })

      await interaction.reply({ content: `${EMOJIS.SUCCESS} Badge **${badge.name}** removida de **${target.username}**.`, ephemeral: true })
      return
    }

    await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
  },
}
