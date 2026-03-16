import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js'
import type { MessageContextMenuCommandInteraction } from 'discord.js'

import { EMOJIS } from '@yuebot/shared'

import type { ContextMenuCommand } from '../index'
import { authenticatedMessageService } from '../../services/authenticatedMessage.service'
import { safe_reply_ephemeral } from '../../utils/interaction'

export const saveMessageHereCommand: ContextMenuCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Salvar mensagem (Enviar aqui)')
    .setType(ApplicationCommandType.Message),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const message = interaction.targetMessage

    if (!interaction.guildId) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores.` })
      return
    }

    if (!message) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Mensagem inválida.` })
      return
    }

    await interaction.deferReply()

    const attachment = await authenticatedMessageService
      .render_signed_message_image({
        message,
        requestedBy: interaction.user,
      })
      .catch(() => null)

    if (!attachment) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível gerar a imagem desta mensagem.` })
      return
    }

    await interaction.editReply({
      content: `Use \`/verificarmensagem\` para checar a autenticidade desta imagem.`,
      files: [attachment],
      allowedMentions: { parse: [] },
    })
  },
}
