import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js'
import type { MessageContextMenuCommandInteraction } from 'discord.js'

import { EMOJIS } from '@yuebot/shared'

import type { ContextMenuCommand } from '../index'
import { authenticatedMessageService } from '../../services/authenticatedMessage.service'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction'

export const saveMessageDmCommand: ContextMenuCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Salvar mensagem (Enviar na DM)')
    .setType(ApplicationCommandType.Message),

  async execute(interaction: MessageContextMenuCommandInteraction) {
    const message = interaction.targetMessage

    if (!interaction.guildId) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores.` })
      return
    }

    await safe_defer_ephemeral(interaction)

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

    try {
      await interaction.user.send({
        content: `Use \`/verificarmensagem\` para checar a autenticidade desta imagem.`,
        files: [attachment],
        allowedMentions: { parse: [] },
      })

      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Mensagem salva e enviada para sua DM.` })
    } catch {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível enviar DM. Verifique suas configurações de privacidade.` })
    }
  },
}
