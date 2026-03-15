import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js'
import type {
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  GuildTextBasedChannel,
} from 'discord.js'

import { EMOJIS } from '@yuebot/shared'

import type { ContextMenuCommand } from '../index'
import { reportLogService } from '../../services/reportLog.service'
import { RateLimiter } from '../../utils/rate_limiter'

const MODAL_PREFIX = 'report:msg'

const report_message_rate_limiter = new RateLimiter({ windowMs: 30_000, max: 1 })

function modal_custom_id(channel_id: string, message_id: string, author_id: string) {
  return `${MODAL_PREFIX}:${channel_id}:${message_id}:${author_id}`
}

function parse_modal_custom_id(custom_id: string): { channelId: string; messageId: string; authorId: string } | null {
  if (!custom_id.startsWith(`${MODAL_PREFIX}:`)) return null
  const parts = custom_id.split(':')
  if (parts.length !== 5) return null
  const channelId = parts[2]
  const messageId = parts[3]
  const authorId = parts[4]
  if (!channelId || !messageId || !authorId) return null
  return { channelId, messageId, authorId }
}

export async function handle_report_message_modal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores.`, ephemeral: true })
    return
  }

  const parsed = parse_modal_custom_id(interaction.customId)
  if (!parsed) return

  const reason = interaction.fields.getTextInputValue('motivo').trim()
  if (!reason) {
    await interaction.reply({ content: `${EMOJIS.ERROR} Motivo inválido.`, ephemeral: true })
    return
  }

  if (reason.length < 10) {
    await interaction.reply({ content: `${EMOJIS.ERROR} Forneça um motivo mais detalhado (mínimo 10 caracteres).`, ephemeral: true })
    return
  }

  const rate_key = `${interaction.guildId}:${interaction.user.id}`
  const rate = report_message_rate_limiter.tryConsume(rate_key)
  if (!rate.allowed) {
    const seconds = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))
    await interaction.reply({
      content: `${EMOJIS.ERROR} Você está fazendo denúncias rápido demais. Tente novamente em ~${seconds}s.`,
      ephemeral: true,
    })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const channel = (await interaction.guild.channels.fetch(parsed.channelId).catch(() => null)) as GuildTextBasedChannel | null
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({ content: `${EMOJIS.ERROR} Canal da mensagem não encontrado.` })
    return
  }

  const url = `https://discord.com/channels/${interaction.guildId}/${parsed.channelId}/${parsed.messageId}`

  const message = await channel.messages.fetch(parsed.messageId).catch(() => null)
  const content = message?.content?.trim() ?? ''
  const snippet = content.length > 900 ? `${content.slice(0, 900)}…` : content

  const reported_user = await interaction.client.users.fetch(parsed.authorId).catch(() => null)
  if (!reported_user) {
    await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível identificar o autor da mensagem.` })
    return
  }

  const message_text = message ? (snippet || '**(sem conteúdo)**') : '**(mensagem indisponível)**'
  const full_reason = `${reason}\n\nMensagem: ${message_text}\nLink: ${url}`

  await reportLogService.notify({
    guild: interaction.guild,
    reportedUser: reported_user,
    reporter: interaction.user,
    reason: full_reason,
  })

  await interaction.editReply({ content: `${EMOJIS.SUCCESS} Denúncia enviada. Obrigado!` })
}

export const reportMessageCommand: ContextMenuCommand = {
  data: new ContextMenuCommandBuilder().setName('Reportar mensagem').setType(ApplicationCommandType.Message),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores.`, ephemeral: true })
      return
    }

    const message = interaction.targetMessage
    if (!message) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Mensagem inválida.`, ephemeral: true })
      return
    }

    const modal = new ModalBuilder()
      .setCustomId(modal_custom_id(message.channelId, message.id, message.author.id))
      .setTitle('Denunciar mensagem')

    const motivo = new TextInputBuilder()
      .setCustomId('motivo')
      .setLabel('Motivo da denúncia')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1500)

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(motivo))

    await interaction.showModal(modal)
  },
}
