import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setNameLocalizations({ 'pt-BR': 'ping' })
    .setDescription('Check the bot\'s latency')
    .setDescriptionLocalizations({ 'pt-BR': 'Verifique a latência do bot' }),

  async execute(interaction: ChatInputCommandInteraction) {
    // Measure WebSocket latency (heartbeat latency)
    const sent = await interaction.reply({
      content: `${EMOJIS.LOADING} Calculando latência...`,
      fetchReply: true,
    })

    const wsLatency = interaction.client.ws.ping
    const replyLatency = sent.createdTimestamp - interaction.createdTimestamp

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} Latência do Bot`)
      .setDescription(
        `📊 **Latência do WebSocket:** ${wsLatency}ms
⏱️ **Latência do comando:** ${replyLatency}ms`
      )
      .setFooter({ text: 'Latência do WebSocket é a conexão com os servidores da Discord.' })

    await interaction.editReply({ embeds: [embed], content: undefined })
  },
}

export default pingCommand
