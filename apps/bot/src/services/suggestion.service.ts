import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import type { ButtonInteraction, Guild, GuildMember, GuildTextBasedChannel, Message, ModalSubmitInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'
import { EMOJIS } from '@yuebot/shared'

import { CONFIG } from '../config'
import { safe_error_details } from '../utils/safe_error'
import { logger } from '../utils/logger'

type suggestion_config = {
  enabled: boolean
  channelId: string | null
  logChannelId: string | null
}

type suggestion_status = 'pending' | 'accepted' | 'denied'

type vote_kind = 'up' | 'down'

type decide_kind = 'accept' | 'deny'

async function get_text_channel(guild: Guild, channel_id: string | null): Promise<GuildTextBasedChannel | null> {
  if (!channel_id) return null
  const channel = await guild.channels.fetch(channel_id).catch(() => null)
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null
  return channel as GuildTextBasedChannel
}

function clamp_embed_description(input: string): string {
  const trimmed = input.trim()
  if (trimmed.length <= 3900) return trimmed
  return `${trimmed.slice(0, 3900)}…`
}

function normalize_config(row: { enabled: boolean; channelId: string | null; logChannelId: string | null } | null): suggestion_config {
  return {
    enabled: row?.enabled ?? false,
    channelId: row?.channelId ?? null,
    logChannelId: row?.logChannelId ?? null,
  }
}

function status_color(status: suggestion_status): number {
  if (status === 'accepted') return Colors.Green
  if (status === 'denied') return Colors.Red
  return Colors.Blurple
}

function status_label(status: suggestion_status): string {
  if (status === 'accepted') return 'Aceita'
  if (status === 'denied') return 'Negada'
  return 'Pendente'
}

function build_components(status: suggestion_status, suggestion_id: string) {
  const disabled = status !== 'pending'

  const up = new ButtonBuilder()
    .setCustomId(`suggestion:vote:up:${suggestion_id}`)
    .setLabel('👍')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled)

  const down = new ButtonBuilder()
    .setCustomId(`suggestion:vote:down:${suggestion_id}`)
    .setLabel('👎')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled)

  const accept = new ButtonBuilder()
    .setCustomId(`suggestion:decide:accept:${suggestion_id}`)
    .setLabel('✅ Aceitar')
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled)

  const deny = new ButtonBuilder()
    .setCustomId(`suggestion:decide:deny:${suggestion_id}`)
    .setLabel('❌ Negar')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled)

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(up, down, accept, deny)]
}

function build_embed(input: {
  suggestion_id: string
  user_id: string
  content: string
  status: suggestion_status
  upvotes: number
  downvotes: number
  decided_by_user_id: string | null
  decision_note: string | null
}) {
  const embed = new EmbedBuilder()
    .setColor(status_color(input.status))
    .setTitle(`💡 Sugestão • ${status_label(input.status)}`)
    .setDescription(clamp_embed_description(input.content))
    .addFields([
      { name: 'Autor', value: `<@${input.user_id}>`, inline: true },
      { name: 'Votos', value: `👍 ${input.upvotes} • 👎 ${input.downvotes}`, inline: true },
    ])
    .setFooter({ text: `ID: ${input.suggestion_id}` })

  if (input.status !== 'pending') {
    embed.addFields([
      { name: 'Decisão', value: `${input.status === 'accepted' ? '✅ Aceita' : '❌ Negada'}${input.decided_by_user_id ? ` por <@${input.decided_by_user_id}>` : ''}` },
      ...(input.decision_note ? [{ name: 'Nota', value: input.decision_note.slice(0, 1024) }] : []),
    ])
  }

  return embed
}

async function can_manage_suggestions(guild: Guild, user_id: string): Promise<boolean> {
  if (CONFIG.admin.ownerUserIds.includes(user_id)) return true

  const member: GuildMember | null = await guild.members.fetch(user_id).catch(() => null)
  if (!member) return false

  return Boolean(
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      member.permissions.has(PermissionFlagsBits.Administrator)
  )
}

function parse_button_custom_id(custom_id: string):
  | { kind: 'vote'; vote: vote_kind; suggestionId: string }
  | { kind: 'decide'; decision: decide_kind; suggestionId: string }
  | null {
  const parts = custom_id.split(':')
  if (parts.length !== 4) return null

  const [prefix, kind, action, suggestionId] = parts
  if (prefix !== 'suggestion') return null
  if (!suggestionId) return null

  if (kind === 'vote' && (action === 'up' || action === 'down')) {
    return { kind: 'vote', vote: action, suggestionId }
  }

  if (kind === 'decide' && (action === 'accept' || action === 'deny')) {
    return { kind: 'decide', decision: action, suggestionId }
  }

  return null
}

function parse_modal_custom_id(custom_id: string): { decision: decide_kind; suggestionId: string } | null {
  const parts = custom_id.split(':')
  if (parts.length !== 4) return null

  const [prefix, kind, decision, suggestionId] = parts
  if (prefix !== 'suggestion') return null
  if (kind !== 'decision') return null
  if (decision !== 'accept' && decision !== 'deny') return null
  if (!suggestionId) return null

  return { decision, suggestionId }
}

class SuggestionService {
  async get_config(guild_id: string): Promise<suggestion_config> {
    const row = await prisma.suggestionConfig.findUnique({
      where: { guildId: guild_id },
      select: {
        enabled: true,
        channelId: true,
        logChannelId: true,
      },
    })

    return normalize_config(row)
  }

  async handle_message(message: Message): Promise<boolean> {
    if (message.author.bot) return false
    if (!message.guild) return false

    const config = await this.get_config(message.guild.id)
    if (!config.enabled || !config.channelId) return false
    if (message.channelId !== config.channelId) return false

    const content = message.content?.trim() ?? ''
    if (!content) return false

    try {
      if (!message.channel.isTextBased() || message.channel.isDMBased()) return false
      const channel = message.channel as GuildTextBasedChannel

      const initial_message_id = message.id
      const suggestion = await prisma.suggestion.create({
        data: {
          guildId: message.guild.id,
          userId: message.author.id,
          sourceChannelId: message.channelId,
          sourceMessageId: message.id,
          messageId: initial_message_id,
          content,
        },
      })

      const embed = build_embed({
        suggestion_id: suggestion.id,
        user_id: suggestion.userId,
        content: suggestion.content,
        status: suggestion.status as suggestion_status,
        upvotes: suggestion.upvotes,
        downvotes: suggestion.downvotes,
        decided_by_user_id: suggestion.decidedByUserId,
        decision_note: suggestion.decisionNote,
      })

      let sent: Message | null = null

      try {
        sent = await channel.send({
          embeds: [embed],
          components: build_components('pending', suggestion.id),
          allowedMentions: { parse: [] },
        })

        await prisma.suggestion.update({
          where: { id: suggestion.id },
          data: { messageId: sent.id },
        })
      } catch (error: unknown) {
        await prisma.suggestion.delete({ where: { id: suggestion.id } }).catch(() => undefined)
        throw error
      }

      if (message.deletable) {
        await message.delete().catch(() => undefined)
      }

      return true
    } catch (error: unknown) {
      logger.error({ err: safe_error_details(error) }, 'Failed to handle suggestion message')
      return false
    }
  }

  async handle_button(interaction: ButtonInteraction): Promise<void> {
    const parsed = parse_button_custom_id(interaction.customId)
    if (!parsed) return

    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Este recurso só funciona em servidores.`, ephemeral: true })
      return
    }

    if (parsed.kind === 'decide') {
      const allowed = await can_manage_suggestions(interaction.guild, interaction.user.id)
      if (!allowed) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Sem permissão.`, ephemeral: true })
        return
      }

      const modal = new ModalBuilder()
        .setCustomId(`suggestion:decision:${parsed.decision}:${parsed.suggestionId}`)
        .setTitle(parsed.decision === 'accept' ? 'Aceitar sugestão' : 'Negar sugestão')

      const note = new TextInputBuilder()
        .setCustomId('note')
        .setLabel('Nota (opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500)

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(note))

      await interaction.showModal(modal)
      return
    }

    await interaction.deferReply({ ephemeral: true })

    try {
      const result = await prisma.$transaction(async (tx) => {
        const suggestion = await tx.suggestion.findUnique({
          where: { id: parsed.suggestionId },
          select: {
            id: true,
            guildId: true,
            status: true,
            userId: true,
            content: true,
            upvotes: true,
            downvotes: true,
            decidedByUserId: true,
            decisionNote: true,
          },
        })

        if (!suggestion) {
          return { ok: false as const, error: 'not_found' as const }
        }

        if (suggestion.guildId !== interaction.guildId) {
          return { ok: false as const, error: 'wrong_guild' as const }
        }

        if (suggestion.status !== 'pending') {
          return { ok: false as const, error: 'closed' as const }
        }

        const existing = await tx.suggestionVote.findUnique({
          where: {
            suggestionId_userId: {
              suggestionId: suggestion.id,
              userId: interaction.user.id,
            },
          },
          select: { id: true, vote: true },
        })

        let upvotes = suggestion.upvotes
        let downvotes = suggestion.downvotes

        if (!existing) {
          await tx.suggestionVote.create({
            data: {
              suggestionId: suggestion.id,
              userId: interaction.user.id,
              vote: parsed.vote,
            },
          })

          if (parsed.vote === 'up') upvotes += 1
          else downvotes += 1
        } else if (existing.vote === parsed.vote) {
          await tx.suggestionVote.delete({ where: { id: existing.id } })

          if (parsed.vote === 'up') upvotes = Math.max(0, upvotes - 1)
          else downvotes = Math.max(0, downvotes - 1)
        } else {
          await tx.suggestionVote.update({ where: { id: existing.id }, data: { vote: parsed.vote } })

          if (parsed.vote === 'up') {
            upvotes += 1
            downvotes = Math.max(0, downvotes - 1)
          } else {
            downvotes += 1
            upvotes = Math.max(0, upvotes - 1)
          }
        }

        const updated = await tx.suggestion.update({
          where: { id: suggestion.id },
          data: { upvotes, downvotes },
          select: {
            id: true,
            userId: true,
            content: true,
            status: true,
            upvotes: true,
            downvotes: true,
            decidedByUserId: true,
            decisionNote: true,
          },
        })

        return { ok: true as const, suggestion: updated }
      })

      if (!result.ok) {
        const msg =
          result.error === 'not_found'
            ? 'Sugestão não encontrada.'
            : result.error === 'closed'
              ? 'Esta sugestão já foi encerrada.'
              : 'Não foi possível votar nesta sugestão.'

        await interaction.editReply({ content: `${EMOJIS.ERROR} ${msg}` })
        return
      }

      const embed = build_embed({
        suggestion_id: result.suggestion.id,
        user_id: result.suggestion.userId,
        content: result.suggestion.content,
        status: result.suggestion.status as suggestion_status,
        upvotes: result.suggestion.upvotes,
        downvotes: result.suggestion.downvotes,
        decided_by_user_id: result.suggestion.decidedByUserId,
        decision_note: result.suggestion.decisionNote,
      })

      await interaction.message.edit({ embeds: [embed] }).catch(() => undefined)
      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Voto registrado.` })
    } catch (error: unknown) {
      logger.error({ err: safe_error_details(error) }, 'Failed to handle suggestion vote')
      await interaction.editReply({ content: `${EMOJIS.ERROR} Erro ao registrar voto.` })
    }
  }

  async handle_decision_modal(interaction: ModalSubmitInteraction): Promise<void> {
    const parsed = parse_modal_custom_id(interaction.customId)
    if (!parsed) return

    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Este recurso só funciona em servidores.`, ephemeral: true })
      return
    }

    const allowed = await can_manage_suggestions(interaction.guild, interaction.user.id)
    if (!allowed) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Sem permissão.`, ephemeral: true })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    const note_raw = interaction.fields.getTextInputValue('note')
    const note = typeof note_raw === 'string' && note_raw.trim().length > 0 ? note_raw.trim() : null

    try {
      const decided_status: suggestion_status = parsed.decision === 'accept' ? 'accepted' : 'denied'

      const updated = await prisma.suggestion.update({
        where: { id: parsed.suggestionId },
        data: {
          status: decided_status,
          decidedAt: new Date(),
          decidedByUserId: interaction.user.id,
          decisionNote: note,
        },
        select: {
          id: true,
          guildId: true,
          userId: true,
          content: true,
          status: true,
          upvotes: true,
          downvotes: true,
          decidedByUserId: true,
          decisionNote: true,
          messageId: true,
          sourceChannelId: true,
        },
      })

      if (updated.guildId !== interaction.guildId) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Sugestão não pertence a esta guild.` })
        return
      }

      const embed = build_embed({
        suggestion_id: updated.id,
        user_id: updated.userId,
        content: updated.content,
        status: updated.status as suggestion_status,
        upvotes: updated.upvotes,
        downvotes: updated.downvotes,
        decided_by_user_id: updated.decidedByUserId,
        decision_note: updated.decisionNote,
      })

      const channel = await get_text_channel(interaction.guild, updated.sourceChannelId)
      if (channel) {
        const msg = await channel.messages.fetch(updated.messageId).catch(() => null)
        if (msg) {
          await msg
            .edit({
              embeds: [embed],
              components: build_components(updated.status as suggestion_status, updated.id),
              allowedMentions: { parse: [] },
            })
            .catch(() => undefined)
        }
      }

      const cfg = await this.get_config(updated.guildId)
      const log_channel = await get_text_channel(interaction.guild, cfg.logChannelId)
      if (log_channel) {
        const log_embed = new EmbedBuilder()
          .setColor(status_color(updated.status as suggestion_status))
          .setTitle(`💡 Sugestão ${updated.status === 'accepted' ? 'aceita' : 'negada'}`)
          .setDescription(clamp_embed_description(updated.content))
          .addFields([
            { name: 'Autor', value: `<@${updated.userId}>`, inline: true },
            { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
          ])

        if (updated.decisionNote) {
          log_embed.addFields([{ name: 'Nota', value: updated.decisionNote.slice(0, 1024) }])
        }

        await log_channel.send({ embeds: [log_embed], allowedMentions: { parse: [] } }).catch(() => undefined)
      }

      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Sugestão atualizada.` })
    } catch (error: unknown) {
      logger.error({ err: safe_error_details(error) }, 'Failed to decide suggestion')
      await interaction.editReply({ content: `${EMOJIS.ERROR} Erro ao atualizar sugestão.` })
    }
  }
}

export const suggestionService = new SuggestionService()
