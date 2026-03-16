import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js'
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'
import { reactionRoleService } from '../../services/reactionRole.service'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction'

type panel_mode = 'single' | 'multiple'

function normalize_panel_mode(input: string | null): panel_mode {
  return input === 'single' ? 'single' : 'multiple'
}

function normalize_optional_string(input: string | null | undefined): string | null {
  const value = typeof input === 'string' ? input.trim() : ''
  return value ? value : null
}

function clamp_string(input: string, max_len: number): string {
  return input.length > max_len ? input.slice(0, max_len) : input
}

function clamp_autocomplete_name(input: string): string {
  return clamp_string(input, 100)
}

function must_be_in_guild(interaction: ChatInputCommandInteraction): interaction is ChatInputCommandInteraction & { guild: NonNullable<ChatInputCommandInteraction['guild']> } {
  return Boolean(interaction.guild)
}

async function get_bot_member(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return null
  return interaction.guild.members.fetchMe().catch(() => null)
}

export const reactionrolesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('Gerenciar painéis de reaction roles (botões/reações)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Criar um novo painel')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Nome do painel')
            .setRequired(true)
            .setMaxLength(64)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Primeiro cargo do painel')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Modo de seleção')
            .setRequired(false)
            .addChoices(
              { name: 'multiple', value: 'multiple' },
              { name: 'single', value: 'single' }
            )
        )
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Ativar o painel')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('label')
            .setDescription('Label do item (opcional)')
            .setRequired(false)
            .setMaxLength(80)
        )
        .addStringOption((opt) =>
          opt
            .setName('emoji')
            .setDescription('Emoji do item (opcional)')
            .setRequired(false)
            .setMaxLength(64)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Listar painéis')
    )
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription('Mostrar detalhes de um painel')
        .addStringOption((opt) =>
          opt
            .setName('panel_id')
            .setDescription('ID do painel')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('publish')
        .setDescription('Publicar/atualizar a mensagem do painel')
        .addStringOption((opt) =>
          opt
            .setName('panel_id')
            .setDescription('ID do painel')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Canal onde o painel será enviado')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Deletar um painel')
        .addStringOption((opt) =>
          opt
            .setName('panel_id')
            .setDescription('ID do painel')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add-item')
        .setDescription('Adicionar item (cargo) ao painel')
        .addStringOption((opt) =>
          opt
            .setName('panel_id')
            .setDescription('ID do painel')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Cargo a adicionar')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('label')
            .setDescription('Label do item (opcional)')
            .setRequired(false)
            .setMaxLength(80)
        )
        .addStringOption((opt) =>
          opt
            .setName('emoji')
            .setDescription('Emoji do item (opcional)')
            .setRequired(false)
            .setMaxLength(64)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-item')
        .setDescription('Remover item (cargo) do painel')
        .addStringOption((opt) =>
          opt
            .setName('panel_id')
            .setDescription('ID do painel')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Cargo a remover')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Atualizar propriedades do painel')
        .addStringOption((opt) =>
          opt
            .setName('panel_id')
            .setDescription('ID do painel')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Novo nome (opcional)')
            .setRequired(false)
            .setMaxLength(64)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Ativar/desativar (opcional)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Modo de seleção (opcional)')
            .setRequired(false)
            .addChoices(
              { name: 'multiple', value: 'multiple' },
              { name: 'single', value: 'single' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('sync')
        .setDescription('Re-sincronizar a mensagem já publicada (re-render + reações)')
        .addStringOption((opt) =>
          opt
            .setName('panel_id')
            .setDescription('ID do painel')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) {
      await interaction.respond([])
      return
    }

    const focused = interaction.options.getFocused(true)
    if (focused.name !== 'panel_id') {
      await interaction.respond([])
      return
    }

    const query = typeof focused.value === 'string' ? focused.value.trim() : ''
    const where =
      query.length > 0
        ? {
            guildId: interaction.guildId,
            OR: [
              { id: { contains: query } },
              { name: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : { guildId: interaction.guildId }

    const panels = await prisma.reactionRolePanel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, name: true },
    })

    await interaction.respond(
      panels.map((p) => ({
        name: clamp_autocomplete_name(`${p.name} — ${p.id}`),
        value: p.id,
      }))
    )
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!must_be_in_guild(interaction)) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Use isso em um servidor.` })
      return
    }

    const sub = interaction.options.getSubcommand()

    if (sub === 'list') {
      await safe_defer_ephemeral(interaction)

      const panels = await prisma.reactionRolePanel.findMany({
        where: { guildId: interaction.guild.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          enabled: true,
          mode: true,
          channelId: true,
          messageId: true,
          _count: { select: { items: true } },
        },
      })

      if (panels.length === 0) {
        await interaction.editReply({ content: `${EMOJIS.INFO} Nenhum painel encontrado.` })
        return
      }

      const lines: string[] = []
      for (const p of panels.slice(0, 15)) {
        lines.push(
          `\`${p.id}\` — **${p.name}** (${p._count.items}) — ` +
            `modo: **${p.mode === 'single' ? 'single' : 'multiple'}** — ` +
            `ativo: **${p.enabled ? 'sim' : 'não'}**`
        )
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('🎭 Reaction Roles — Painéis')
        .setDescription(lines.join('\n'))
        .setFooter({ text: panels.length > 15 ? `Mostrando 15 de ${panels.length}` : `${panels.length} painel(is)` })

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'create') {
      await safe_defer_ephemeral(interaction)

      const name = clamp_string(interaction.options.getString('name', true).trim(), 64)
      if (!name) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Nome inválido.` })
        return
      }

      const enabled = interaction.options.getBoolean('enabled') ?? true
      const mode = normalize_panel_mode(interaction.options.getString('mode'))

      const role = interaction.options.getRole('role', true)
      if (role.managed) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Não é possível usar um cargo gerenciado.` })
        return
      }

      const label = normalize_optional_string(interaction.options.getString('label'))
      const emoji = normalize_optional_string(interaction.options.getString('emoji'))

      const created = await prisma.reactionRolePanel.create({
        data: {
          guildId: interaction.guild.id,
          name,
          enabled,
          mode,
          items: {
            create: [{ roleId: role.id, label, emoji }],
          },
        },
        select: { id: true },
      })

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Painel criado`)
        .setDescription(`ID: \`${created.id}\`\nNome: **${name}**\nModo: **${mode}**\nAtivo: **${enabled ? 'sim' : 'não'}**`)

      await interaction.editReply({ embeds: [embed] })
      return
    }

    const panel_id = interaction.options.getString('panel_id', true).trim()
    if (!panel_id) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Panel ID inválido.` })
      return
    }

    if (sub === 'show') {
      await safe_defer_ephemeral(interaction)

      const panel = await prisma.reactionRolePanel.findUnique({
        where: { id: panel_id },
        select: {
          id: true,
          guildId: true,
          name: true,
          enabled: true,
          mode: true,
          channelId: true,
          messageId: true,
          items: {
            orderBy: { createdAt: 'asc' },
            select: { roleId: true, label: true, emoji: true },
          },
        },
      })

      if (!panel || panel.guildId !== interaction.guild.id) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Painel não encontrado.` })
        return
      }

      const item_lines = panel.items.slice(0, 25).map((i) => {
        const emoji = i.emoji ? `${i.emoji} ` : ''
        const label = i.label ? ` — ${i.label}` : ''
        return `${emoji}<@&${i.roleId}>${label}`
      })

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`🎭 ${panel.name}`)
        .setDescription(item_lines.length > 0 ? item_lines.join('\n') : 'Nenhum item configurado.')
        .addFields([
          { name: 'ID', value: `\`${panel.id}\``, inline: false },
          { name: 'Modo', value: panel.mode === 'single' ? 'single' : 'multiple', inline: true },
          { name: 'Ativo', value: panel.enabled ? 'sim' : 'não', inline: true },
        ])

      if (panel.channelId) {
        embed.addFields([{ name: 'Canal', value: `<#${panel.channelId}>`, inline: true }])
      }
      if (panel.messageId) {
        embed.addFields([{ name: 'Mensagem', value: `\`${panel.messageId}\``, inline: true }])
      }

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'delete') {
      await safe_defer_ephemeral(interaction)

      const existing = await prisma.reactionRolePanel.findUnique({ where: { id: panel_id }, select: { id: true, guildId: true } })
      if (!existing || existing.guildId !== interaction.guild.id) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Painel não encontrado.` })
        return
      }

      await prisma.reactionRolePanel.delete({ where: { id: panel_id } })
      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Painel deletado: \`${panel_id}\`` })
      return
    }

    if (sub === 'add-item') {
      await safe_defer_ephemeral(interaction)

      const panel = await prisma.reactionRolePanel.findUnique({
        where: { id: panel_id },
        select: { id: true, guildId: true, _count: { select: { items: true } } },
      })

      if (!panel || panel.guildId !== interaction.guild.id) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Painel não encontrado.` })
        return
      }

      if (panel._count.items >= 25) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Este painel já tem 25 itens.` })
        return
      }

      const role = interaction.options.getRole('role', true)
      if (role.managed) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Não é possível usar um cargo gerenciado.` })
        return
      }

      const label = normalize_optional_string(interaction.options.getString('label'))
      const emoji = normalize_optional_string(interaction.options.getString('emoji'))

      try {
        await prisma.reactionRoleItem.create({
          data: {
            panelId: panel.id,
            roleId: role.id,
            label,
            emoji,
          },
          select: { id: true },
        })
      } catch {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível adicionar item (talvez já exista).` })
        return
      }

      const me = await get_bot_member(interaction)
      const editable_hint = me && 'editable' in role ? (role.editable ? '' : ' (atenção: bot não consegue gerenciar este cargo pela hierarquia)') : ''

      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Item adicionado: <@&${role.id}>${editable_hint}` })
      return
    }

    if (sub === 'remove-item') {
      await safe_defer_ephemeral(interaction)

      const panel = await prisma.reactionRolePanel.findUnique({ where: { id: panel_id }, select: { id: true, guildId: true } })
      if (!panel || panel.guildId !== interaction.guild.id) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Painel não encontrado.` })
        return
      }

      const role = interaction.options.getRole('role', true)

      const removed = await prisma.reactionRoleItem.deleteMany({
        where: {
          panelId: panel.id,
          roleId: role.id,
        },
      })

      if (removed.count === 0) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Item não encontrado neste painel.` })
        return
      }

      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Item removido: <@&${role.id}>` })
      return
    }

    if (sub === 'set') {
      await safe_defer_ephemeral(interaction)

      const name = normalize_optional_string(interaction.options.getString('name'))
      const enabled = interaction.options.getBoolean('enabled')
      const mode_raw = interaction.options.getString('mode')

      if (!name && enabled === null && !mode_raw) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Informe ao menos um campo para atualizar.` })
        return
      }

      const existing = await prisma.reactionRolePanel.findUnique({ where: { id: panel_id }, select: { id: true, guildId: true } })
      if (!existing || existing.guildId !== interaction.guild.id) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Painel não encontrado.` })
        return
      }

      const mode = mode_raw ? normalize_panel_mode(mode_raw) : null

      await prisma.reactionRolePanel.update({
        where: { id: panel_id },
        data: {
          ...(name ? { name: clamp_string(name, 64) } : {}),
          ...(enabled !== null ? { enabled } : {}),
          ...(mode ? { mode } : {}),
        },
      })

      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Painel atualizado: \`${panel_id}\`` })
      return
    }

    if (sub === 'sync') {
      await safe_defer_ephemeral(interaction)

      const panel = await prisma.reactionRolePanel.findUnique({
        where: { id: panel_id },
        select: { id: true, guildId: true, channelId: true, messageId: true },
      })

      if (!panel || panel.guildId !== interaction.guild.id) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Painel não encontrado.` })
        return
      }

      if (!panel.channelId) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Este painel ainda não foi publicado. Use /reactionroles publish.` })
        return
      }

      const ensured = await reactionRoleService.ensure_panel_message(
        interaction.guild,
        panel.id,
        panel.channelId,
        panel.messageId ?? null
      )

      await prisma.reactionRolePanel.update({
        where: { id: panel.id },
        data: { messageId: ensured.messageId },
      })

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Painel sincronizado`)
        .setDescription(`Canal: <#${panel.channelId}>\nMensagem: \`${ensured.messageId}\``)

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'publish') {
      await safe_defer_ephemeral(interaction)

      const channel = interaction.options.getChannel('channel', true)
      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Canal inválido.` })
        return
      }

      const panel = await prisma.reactionRolePanel.findUnique({
        where: { id: panel_id },
        select: { id: true, guildId: true, messageId: true },
      })

      if (!panel || panel.guildId !== interaction.guild.id) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Painel não encontrado.` })
        return
      }

      const channel_fetched = await interaction.guild.channels.fetch(channel.id).catch(() => null)
      if (!channel_fetched || !channel_fetched.isTextBased() || channel_fetched.isDMBased()) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Canal inválido.` })
        return
      }

      const me = await interaction.guild.members.fetchMe().catch(() => null)
      const perms =
        me && 'permissionsFor' in channel_fetched && typeof channel_fetched.permissionsFor === 'function'
          ? channel_fetched.permissionsFor(me)
          : null

      if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Eu não tenho permissão para enviar embeds nesse canal.` })
        return
      }

      const ensured = await reactionRoleService.ensure_panel_message(interaction.guild, panel.id, channel.id, panel.messageId ?? null)

      await prisma.reactionRolePanel.update({
        where: { id: panel.id },
        data: {
          channelId: channel.id,
          messageId: ensured.messageId,
        },
      })

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Painel publicado`)
        .setDescription(`Canal: <#${channel.id}>\nMensagem: \`${ensured.messageId}\``)

      await interaction.editReply({ embeds: [embed] })
      return
    }

    await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Subcomando inválido.` })
  },
}
