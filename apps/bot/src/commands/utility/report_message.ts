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

const MODAL_PREFIX = 'report:msg'

function modal_custom_id(channel_id: string, message_id: string) {
  return `${MODAL_PREFIX}:${channel_id}:${message_id}`
}

function parse_modal_custom_id(custom_id: string): { channelId: string; messageId: string } | null {
  if (!custom_id.startsWith(`${MODAL_PREFIX}:`)) return null
  const parts = custom_id.split(':')
  if (parts.length !== 4) return null
  const channelId = parts[2]
  const messageId = parts[3]
  if (!channelId || !messageId) return null
  return { channelId, messageId }
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

  await interaction.deferReply({ ephemeral: true })

  const channel = (await interaction.guild.channels.fetch(parsed.channelId).catch(() => null)) as GuildTextBasedChannel | null
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({ content: `${EMOJIS.ERROR} Canal da mensagem não encontrado.` })
    return
  }

  const message = await channel.messages.fetch(parsed.messageId).catch(() => null)
  if (!message) {
    await interaction.editReply({ content: `${EMOJIS.ERROR} Mensagem não encontrada.` })
    return
  }

  const reported_user = message.author
  const url = message.url
  const content = message.content?.trim() ?? ''
  const snippet = content.length > 900 ? `${content.slice(0, 900)}…` : content

  const full_reason = `${reason}\n\nMensagem: ${snippet || '**(sem conteúdo)**'}\nLink: ${url}`

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
      .setCustomId(modal_custom_id(message.channelId, message.id))
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
