import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { EMOJIS } from '@yuebot/shared'

import { get_groq_client } from '../../services/groq_client_singleton'
import { GroqApiError } from '../../services/groq.service'
import { safe_error_details } from '../../utils/safe_error'
import { logger } from '../../utils/logger'
import type { Command } from '../index'

function clamp_discord_message(input: string, max = 1900): string {
  const trimmed = input.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export const askCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setNameLocalizations({ 'pt-BR': 'perguntar' })
    .setDescription('Ask the bot a question (Groq)')
    .setDescriptionLocalizations({ 'pt-BR': 'Faça uma pergunta para o bot (Groq)' })
    .addStringOption((opt) =>
      opt
        .setName('question')
        .setNameLocalizations({ 'pt-BR': 'pergunta' })
        .setDescription('Your question')
        .setDescriptionLocalizations({ 'pt-BR': 'Sua pergunta' })
        .setRequired(true)
        .setMaxLength(1500)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString('question', true).trim()
    if (!question) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Pergunta inválida.` })
      return
    }

    await interaction.deferReply()

    try {
      const client = get_groq_client()
      if (!client) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Groq não configurado neste bot.` })
        return
      }
      const completion = await client.create_completion({ user_prompt: question })

      const content = clamp_discord_message(completion.content)
      await interaction.editReply({ content })
    } catch (error: unknown) {
      if (error instanceof GroqApiError) {
        if (error.status === 429) {
          const retry = error.retry_after_seconds
          const msg = retry ? `Tente novamente em ~${retry}s.` : 'Tente novamente em instantes.'
          await interaction.editReply({ content: `${EMOJIS.ERROR} Rate limit do Groq. ${msg}` })
          return
        }

        if (error.status === 401 || error.status === 403) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Groq não autorizado. Verifique a configuração das keys.` })
          return
        }

        await interaction.editReply({ content: `${EMOJIS.ERROR} Erro ao consultar Groq.` })
        return
      }

      const message = error instanceof Error ? error.message : ''
      if (message.includes('GROQ_API_KEY')) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Groq não configurado neste bot.` })
        return
      }

      logger.error({ err: safe_error_details(error) }, 'Failed to execute /ask')
      await interaction.editReply({ content: `${EMOJIS.ERROR} Erro inesperado ao executar o comando.` })
    }
  },
}
