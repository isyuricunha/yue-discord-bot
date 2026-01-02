import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import type { ButtonInteraction, Guild, GuildTextBasedChannel, ModalSubmitInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

type ticket_config = {
  enabled: boolean
  categoryId: string | null
  logChannelId: string | null
  supportRoleIds: string[]
  panelChannelId: string | null
  panelMessageId: string | null
}

function normalize_support_role_ids(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 20)
}

function normalize_config(row: {
  enabled: boolean
  categoryId: string | null
  logChannelId: string | null
  supportRoleIds: unknown
  panelChannelId: string | null
  panelMessageId: string | null
} | null): ticket_config {
  return {
    enabled: row?.enabled ?? false,
    categoryId: row?.categoryId ?? null,
    logChannelId: row?.logChannelId ?? null,
    supportRoleIds: normalize_support_role_ids(row?.supportRoleIds),
    panelChannelId: row?.panelChannelId ?? null,
    panelMessageId: row?.panelMessageId ?? null,
  }
}

function sanitize_channel_name(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  const trimmed = base.length > 0 ? base : 'ticket'
  return trimmed.slice(0, 90)
}

async function get_text_channel(guild: Guild, channel_id: string | null): Promise<GuildTextBasedChannel | null> {
  if (!channel_id) return null
  const channel = await guild.channels.fetch(channel_id).catch(() => null)
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null
  return channel
}

async function fetch_guild_member(guild: Guild, user_id: string) {
  return await guild.members.fetch(user_id).catch(() => null)
}

function can_set_channel_name(channel: unknown): channel is { setName: (name: string) => Promise<unknown> } {
  return Boolean(channel && typeof (channel as { setName?: unknown }).setName === 'function')
}

export class TicketService {
  async get_config(guild_id: string): Promise<ticket_config> {
    const row = await prisma.ticketConfig.findUnique({
      where: { guildId: guild_id },
      select: {
        enabled: true,
        categoryId: true,
        logChannelId: true,
        supportRoleIds: true,
        panelChannelId: true,
        panelMessageId: true,
      },
    })

    return normalize_config(row)
  }

  async setup_panel(input: {
    guild_id: string
    enabled: boolean
    panelChannelId: string
    categoryId: string | null
    logChannelId: string | null
    supportRoleIds: string[]
  }): Promise<void> {
    await prisma.ticketConfig.upsert({
      where: { guildId: input.guild_id },
      update: {
        enabled: input.enabled,
        categoryId: input.categoryId,
        logChannelId: input.logChannelId,
        supportRoleIds: input.supportRoleIds,
        panelChannelId: input.panelChannelId,
        panelMessageId: null,
      },
      create: {
        guildId: input.guild_id,
        enabled: input.enabled,
        categoryId: input.categoryId,
        logChannelId: input.logChannelId,
        supportRoleIds: input.supportRoleIds,
        panelChannelId: input.panelChannelId,
        panelMessageId: null,
      },
    })
  }

  async set_panel_message_id(guild_id: string, input: { panelMessageId: string }) {
    await prisma.ticketConfig.update({
      where: { guildId: guild_id },
      data: { panelMessageId: input.panelMessageId },
    })
  }

  build_panel_components() {
    const button = new ButtonBuilder()
      .setCustomId('ticket:open')
      .setStyle(ButtonStyle.Primary)
      .setLabel('Abrir ticket')

    return [new ActionRowBuilder<ButtonBuilder>().addComponents(button)]
  }

  build_panel_embed() {
    return new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🎫 Suporte')
      .setDescription('Clique no botão abaixo para abrir um ticket de suporte.')
  }

  async ensure_panel_message(guild: Guild, panel_channel_id: string, message_id: string | null) {
    const channel = await get_text_channel(guild, panel_channel_id)
    if (!channel) {
      throw new Error('panel channel not found or not text based')
    }

    const embed = this.build_panel_embed()
    const components = this.build_panel_components()

    if (message_id) {
      const existing = await channel.messages.fetch(message_id).catch(() => null)
      if (existing) {
        await existing.edit({ embeds: [embed], components })
        return { channel, messageId: existing.id }
      }
    }

    const sent = await channel.send({ embeds: [embed], components, allowedMentions: { parse: [] } })
    return { channel, messageId: sent.id }
  }

  async handle_open(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    const config = await this.get_config(interaction.guild.id)
    if (!config.enabled) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Tickets estão desativados neste servidor.` })
      return
    }

    const existing = await prisma.ticket.findFirst({
      where: {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        status: 'open',
      },
      select: { id: true, channelId: true },
    })

    if (existing?.channelId) {
      const existing_channel = await interaction.guild.channels.fetch(existing.channelId).catch(() => null)
      if (existing_channel) {
        await interaction.editReply({ content: `${EMOJIS.INFO} Você já tem um ticket aberto: <#${existing.channelId}>` })
        return
      }

      await prisma.ticket.update({
        where: { id: existing.id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closedByUserId: interaction.client.user?.id ?? null,
          closeReason: 'Ticket fechado automaticamente: canal não encontrado.',
        },
      })
    }

    const me = await interaction.guild.members.fetchMe().catch(() => null)
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Eu não tenho permissão para criar canais.` })
      return
    }

    const channel_name = sanitize_channel_name(`ticket-${interaction.user.username}-${interaction.user.id.slice(-4)}`)

    const permission_overwrites = [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: interaction.client.user!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      ...config.supportRoleIds.map((role_id) => ({
        id: role_id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      })),
    ]

    const channel = await interaction.guild.channels.create({
      name: channel_name,
      type: ChannelType.GuildText,
      parent: config.categoryId ?? undefined,
      permissionOverwrites: permission_overwrites,
      topic: `Ticket de suporte | User: ${interaction.user.tag} (${interaction.user.id})`,
    })

    const ticket = await prisma.ticket.create({
      data: {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        channelId: channel.id,
      },
      select: { id: true },
    })

    const close_button = new ButtonBuilder()
      .setCustomId(`ticket:close:${ticket.id}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Fechar ticket')

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(close_button)

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🎫 Ticket aberto')
      .setDescription(`Olá <@${interaction.user.id}>! Descreva seu problema aqui e aguarde o suporte.`)

    await channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } })

    await interaction.editReply({ content: `${EMOJIS.SUCCESS} Ticket criado: <#${channel.id}>` })

    await this.log_event(interaction.guild, config.logChannelId, {
      title: 'Ticket aberto',
      description: `Usuário: <@${interaction.user.id}>\nCanal: <#${channel.id}>`,
    })
  }

  async handle_close_button(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
      return
    }

    const parts = interaction.customId.split(':')
    const ticket_id = parts[2]

    if (!ticket_id) return

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticket_id },
      select: { id: true, guildId: true, userId: true, channelId: true, status: true },
    })

    if (!ticket || ticket.guildId !== interaction.guild.id) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Ticket não encontrado.`, ephemeral: true })
      return
    }

    if (interaction.channelId !== ticket.channelId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Este botão só pode ser usado no canal do ticket.`, ephemeral: true })
      return
    }

    if (ticket.status !== 'open') {
      await interaction.reply({ content: `${EMOJIS.ERROR} Este ticket já está fechado.`, ephemeral: true })
      return
    }

    const config = await this.get_config(interaction.guild.id)

    const member = await fetch_guild_member(interaction.guild, interaction.user.id)
    const is_owner = interaction.user.id === ticket.userId
    const is_support = Boolean(member && config.supportRoleIds.some((role_id) => member.roles.cache.has(role_id)))
    const is_admin = Boolean(member?.permissions.has(PermissionFlagsBits.Administrator))

    if (!is_owner && !is_support && !is_admin) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Você não tem permissão para fechar este ticket.`, ephemeral: true })
      return
    }

    const modal_id = `ticket:close_reason:${ticket.id}`

    const modal = new ModalBuilder().setCustomId(modal_id).setTitle('Fechar ticket')

    const reason_input = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Motivo (opcional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500)

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reason_input)
    modal.addComponents(row)

    await interaction.showModal(modal)
  }

  async handle_close_modal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
      return
    }

    const prefix = 'ticket:close_reason:'
    if (!interaction.customId.startsWith(prefix)) return

    const ticket_id = interaction.customId.slice(prefix.length)

    await interaction.deferReply({ ephemeral: true })

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticket_id },
      select: { id: true, guildId: true, userId: true, channelId: true, status: true },
    })

    if (!ticket || ticket.guildId !== interaction.guild.id) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Ticket não encontrado.` })
      return
    }

    if (ticket.status !== 'open') {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Este ticket já está fechado.` })
      return
    }

    const config = await this.get_config(interaction.guild.id)

    const member = await fetch_guild_member(interaction.guild, interaction.user.id)
    const is_owner = interaction.user.id === ticket.userId
    const is_support = Boolean(member && config.supportRoleIds.some((role_id) => member.roles.cache.has(role_id)))
    const is_admin = Boolean(member?.permissions.has(PermissionFlagsBits.Administrator))

    if (!is_owner && !is_support && !is_admin) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Você não tem permissão para fechar este ticket.` })
      return
    }

    const reason_raw = interaction.fields.getTextInputValue('reason')
    const reason = reason_raw && reason_raw.trim().length > 0 ? reason_raw.trim() : null

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedByUserId: interaction.user.id,
        closeReason: reason,
      },
    })

    const channel = await interaction.guild.channels.fetch(ticket.channelId).catch(() => null)
    if (channel && channel.isTextBased() && !channel.isDMBased()) {
      try {
        await channel.permissionOverwrites.edit(ticket.userId, {
          SendMessages: false,
          AddReactions: false,
        })

        const updated_name = sanitize_channel_name(`closed-${channel.name}`)
        if (can_set_channel_name(channel)) {
          await channel.setName(updated_name).catch(() => undefined)
        }

        await channel.send({
          content:
            `${EMOJIS.SUCCESS} Ticket fechado por <@${interaction.user.id}>.` +
            (reason ? `\nMotivo: ${reason}` : ''),
          allowedMentions: { parse: [] },
        })
      } catch (error) {
        logger.error({ err: safe_error_details(error) }, 'Erro ao finalizar ticket no Discord')
      }
    }

    await this.log_event(interaction.guild, config.logChannelId, {
      title: 'Ticket fechado',
      description:
        `Usuário: <@${ticket.userId}>\n` +
        `Fechado por: <@${interaction.user.id}>\n` +
        `Canal: <#${ticket.channelId}>` +
        (reason ? `\nMotivo: ${reason}` : ''),
    })

    await interaction.editReply({ content: `${EMOJIS.SUCCESS} Ticket fechado.` })
  }

  private async log_event(guild: Guild, log_channel_id: string | null, input: { title: string; description: string }) {
    if (!log_channel_id) return

    const channel = await get_text_channel(guild, log_channel_id)
    if (!channel) return

    const embed = new EmbedBuilder().setColor(COLORS.INFO).setTitle(input.title).setDescription(input.description)

    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((error) => {
      logger.error({ err: safe_error_details(error) }, 'Erro ao enviar log de ticket')
    })
  }
}

export const ticketService = new TicketService()
