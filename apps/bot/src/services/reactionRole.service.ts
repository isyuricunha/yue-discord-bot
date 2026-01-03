import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js'
import type {
  ButtonInteraction,
  Guild,
  GuildTextBasedChannel,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  Role,
  User,
} from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

type panel_mode = 'single' | 'multiple'

type reaction_role_item = {
  roleId: string
  label: string | null
  emoji: string | null
}

type reaction_role_panel = {
  id: string
  guildId: string
  name: string
  enabled: boolean
  mode: panel_mode
  channelId: string | null
  messageId: string | null
  items: reaction_role_item[]
}

async function get_text_channel(guild: Guild, channel_id: string | null): Promise<GuildTextBasedChannel | null> {
  if (!channel_id) return null
  const channel = await guild.channels.fetch(channel_id).catch(() => null)
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null
  return channel
}

function normalize_mode(input: string | null | undefined): panel_mode {
  return input === 'single' ? 'single' : 'multiple'
}

function normalize_panel(row: {
  id: string
  guildId: string
  name: string
  enabled: boolean
  mode: string
  channelId: string | null
  messageId: string | null
  items: Array<{ roleId: string; label: string | null; emoji: string | null }>
} | null): reaction_role_panel | null {
  if (!row) return null

  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    enabled: row.enabled,
    mode: normalize_mode(row.mode),
    channelId: row.channelId,
    messageId: row.messageId,
    items: row.items.map((i) => ({ roleId: i.roleId, label: i.label ?? null, emoji: i.emoji ?? null })),
  }
}

function build_custom_id(panel_id: string, role_id: string) {
  return `rr:${panel_id}:${role_id}`
}

function normalize_emoji_id(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const id_match = trimmed.match(/\d{15,}/)
  if (id_match) return id_match[0]!

  const parts = trimmed.split(':')
  const last = parts.at(-1)
  if (last && /^\d{15,}$/.test(last)) return last

  return null
}

function normalize_reaction_key_from_item_emoji(emoji: string | null) {
  if (!emoji) return null

  const maybe_id = normalize_emoji_id(emoji)
  if (maybe_id) return { kind: 'id' as const, value: maybe_id, react_input: maybe_id }

  const name = emoji.trim()
  if (!name) return null

  return { kind: 'name' as const, value: name, react_input: name }
}

function normalize_reaction_key_from_reaction(reaction: MessageReaction | PartialMessageReaction) {
  if (reaction.emoji.id) return { kind: 'id' as const, value: reaction.emoji.id }
  return { kind: 'name' as const, value: reaction.emoji.name ?? '' }
}

function build_embed(input: {
  panel: reaction_role_panel
  roles_by_id: Map<string, Role>
}) {
  const panel = input.panel

  const lines = panel.items.map((i) => {
    const role = input.roles_by_id.get(i.roleId)
    const label = i.label ?? role?.name ?? i.roleId
    const emoji = i.emoji ? `${i.emoji} ` : ''
    return `${emoji}<@&${i.roleId}> — ${label}`
  })

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`🎭 ${panel.name}`)
    .setDescription(lines.length > 0 ? lines.join('\n') : 'Nenhum cargo configurado.')
    .setFooter({ text: panel.mode === 'single' ? 'Seleção única' : 'Seleção múltipla' })

  return embed
}

function build_components(input: {
  panel: reaction_role_panel
  roles_by_id: Map<string, Role>
}) {
  const buttons = input.panel.items.map((i) => {
    const role = input.roles_by_id.get(i.roleId)
    const label = (i.label ?? role?.name ?? 'Cargo').slice(0, 80)

    const btn = new ButtonBuilder()
      .setCustomId(build_custom_id(input.panel.id, i.roleId))
      .setStyle(ButtonStyle.Secondary)
      .setLabel(label)
      .setDisabled(!input.panel.enabled)

    if (i.emoji) {
      btn.setEmoji(i.emoji)
    }

    return btn
  })

  const rows: Array<ActionRowBuilder<ButtonBuilder>> = []
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)))
  }

  return rows.slice(0, 5)
}

export class ReactionRoleService {
  async get_panel(panel_id: string): Promise<reaction_role_panel | null> {
    const row = await prisma.reactionRolePanel.findUnique({
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
          select: {
            roleId: true,
            label: true,
            emoji: true,
          },
        },
      },
    })

    return normalize_panel(row)
  }

  private async get_panel_by_message_id(guild_id: string, message_id: string): Promise<reaction_role_panel | null> {
    const row = await prisma.reactionRolePanel.findFirst({
      where: { guildId: guild_id, messageId: message_id },
      orderBy: { createdAt: 'desc' },
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
          select: {
            roleId: true,
            label: true,
            emoji: true,
          },
        },
      },
    })

    return normalize_panel(row)
  }

  private async ensure_panel_message_reactions(panel: reaction_role_panel, message: { react: (emoji: string) => Promise<unknown> }) {
    const unique = new Set<string>()

    for (const item of panel.items) {
      const key = normalize_reaction_key_from_item_emoji(item.emoji)
      if (!key) continue
      unique.add(key.react_input)
    }

    for (const emoji of unique) {
      await message.react(emoji)
    }
  }

  async ensure_panel_message(guild: Guild, panel_id: string, channel_id: string, message_id: string | null) {
    const panel = await this.get_panel(panel_id)
    if (!panel) {
      throw new Error('panel not found')
    }

    if (panel.guildId !== guild.id) {
      throw new Error('panel does not belong to this guild')
    }

    const channel = await get_text_channel(guild, channel_id)
    if (!channel) {
      throw new Error('panel channel not found or not text based')
    }

    const role_ids = Array.from(new Set(panel.items.map((i) => i.roleId)))
    const roles = await Promise.all(role_ids.map((id) => guild.roles.fetch(id).catch(() => null)))
    const roles_by_id = new Map<string, Role>()
    for (const r of roles) {
      if (r) roles_by_id.set(r.id, r)
    }

    const embed = build_embed({ panel, roles_by_id })
    const components = build_components({ panel, roles_by_id })

    if (message_id) {
      const existing = await channel.messages.fetch(message_id).catch(() => null)
      if (existing) {
        await existing.edit({ embeds: [embed], components })

        try {
          await this.ensure_panel_message_reactions(panel, existing)
        } catch (error: unknown) {
          logger.warn({ err: safe_error_details(error), guildId: guild.id, panelId: panel.id }, 'Failed to ensure reaction role panel reactions')
        }

        return { channel, messageId: existing.id }
      }
    }

    const sent = await channel.send({ embeds: [embed], components, allowedMentions: { parse: [] } })

    try {
      await this.ensure_panel_message_reactions(panel, sent)
    } catch (error: unknown) {
      logger.warn({ err: safe_error_details(error), guildId: guild.id, panelId: panel.id }, 'Failed to ensure reaction role panel reactions')
    }

    return { channel, messageId: sent.id }
  }

  private async ensure_can_manage_role(guild: Guild, role: Role) {
    const me = await guild.members.fetchMe().catch(() => null)
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('bot lacks ManageRoles permission')
    }

    if (!role.editable) {
      throw new Error('role is not editable by the bot (role hierarchy)')
    }
  }

  async handle_button(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
      return
    }

    const parts = interaction.customId.split(':')
    if (parts.length !== 3 || parts[0] !== 'rr') {
      return
    }

    const panel_id = parts[1]!
    const role_id = parts[2]!

    await interaction.deferReply({ ephemeral: true })

    const panel = await this.get_panel(panel_id)
    if (!panel || panel.guildId !== interaction.guild.id) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Painel não encontrado.` })
      return
    }

    if (!panel.enabled) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Este painel está desativado.` })
      return
    }

    if (!panel.items.some((i) => i.roleId === role_id)) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Cargo inválido.` })
      return
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
    if (!member) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível buscar seu membro no servidor.` })
      return
    }

    const role = await interaction.guild.roles.fetch(role_id).catch(() => null)
    if (!role) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Cargo não encontrado.` })
      return
    }

    try {
      await this.ensure_can_manage_role(interaction.guild, role)

      const has_role = member.roles.cache.has(role_id)

      if (has_role) {
        await member.roles.remove(role_id, `reaction role panel ${panel.id}`)
        await interaction.editReply({ content: `${EMOJIS.SUCCESS} Cargo removido: <@&${role_id}>` })
        return
      }

      if (panel.mode === 'single') {
        const other_role_ids = panel.items.map((i) => i.roleId).filter((id) => id !== role_id)
        const to_remove = other_role_ids.filter((id) => member.roles.cache.has(id))
        if (to_remove.length > 0) {
          await member.roles.remove(to_remove, `reaction role panel ${panel.id} single-select`)
        }
      }

      await member.roles.add(role_id, `reaction role panel ${panel.id}`)
      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Cargo adicionado: <@&${role_id}>` })
    } catch (error: unknown) {
      logger.warn({ err: safe_error_details(error), guildId: interaction.guild.id, panelId: panel_id }, 'Failed to apply reaction role')
      await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível atualizar seu cargo. Verifique permissões/hierarquia.` })
    }
  }

  async handle_reaction_add(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    if (!reaction.message.guild) return
    if (user.bot) return
    if (!reaction.message.id) return

    const panel = await this.get_panel_by_message_id(reaction.message.guild.id, reaction.message.id)
    if (!panel) return
    if (!panel.enabled) return

    const reaction_key = normalize_reaction_key_from_reaction(reaction)
    if (!reaction_key.value) return

    const item = panel.items.find((i) => {
      const key = normalize_reaction_key_from_item_emoji(i.emoji)
      if (!key) return false
      return key.kind === reaction_key.kind && key.value === reaction_key.value
    })

    if (!item) return

    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null)
    if (!member) return

    const role = await reaction.message.guild.roles.fetch(item.roleId).catch(() => null)
    if (!role) return

    try {
      await this.ensure_can_manage_role(reaction.message.guild, role)

      if (panel.mode === 'single') {
        const other_role_ids = panel.items.map((i) => i.roleId).filter((id) => id !== item.roleId)
        const to_remove = other_role_ids.filter((id) => member.roles.cache.has(id))
        if (to_remove.length > 0) {
          await member.roles.remove(to_remove, `reaction role panel ${panel.id} single-select`)
        }
      }

      if (!member.roles.cache.has(item.roleId)) {
        await member.roles.add(item.roleId, `reaction role panel ${panel.id}`)
      }
    } catch (error: unknown) {
      logger.warn(
        { err: safe_error_details(error), guildId: reaction.message.guild.id, panelId: panel.id, roleId: item.roleId },
        'Failed to apply reaction role (reaction add)'
      )
    }
  }

  async handle_reaction_remove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    if (!reaction.message.guild) return
    if (user.bot) return
    if (!reaction.message.id) return

    const panel = await this.get_panel_by_message_id(reaction.message.guild.id, reaction.message.id)
    if (!panel) return
    if (!panel.enabled) return

    const reaction_key = normalize_reaction_key_from_reaction(reaction)
    if (!reaction_key.value) return

    const item = panel.items.find((i) => {
      const key = normalize_reaction_key_from_item_emoji(i.emoji)
      if (!key) return false
      return key.kind === reaction_key.kind && key.value === reaction_key.value
    })

    if (!item) return

    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null)
    if (!member) return

    if (!member.roles.cache.has(item.roleId)) return

    const role = await reaction.message.guild.roles.fetch(item.roleId).catch(() => null)
    if (!role) return

    try {
      await this.ensure_can_manage_role(reaction.message.guild, role)
      await member.roles.remove(item.roleId, `reaction role panel ${panel.id}`)
    } catch (error: unknown) {
      logger.warn(
        { err: safe_error_details(error), guildId: reaction.message.guild.id, panelId: panel.id, roleId: item.roleId },
        'Failed to apply reaction role (reaction remove)'
      )
    }
  }
}

export const reactionRoleService = new ReactionRoleService()
