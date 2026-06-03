import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

import { waifuService } from '../../services/waifu.service'
import { normalize_http_url } from '../../utils/http_url'

export const infocasamentoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('infocasamento')
    .setDescription('Buscar informações de um personagem e ver quem é o dono no servidor')
    .setDescriptionLocalizations({
      'pt-BR': 'Buscar informações de um personagem e ver quem é o dono no servidor',
    })
    .addStringOption((opt) =>
      opt
        .setName('nome')
        .setNameLocalizations({ 'pt-BR': 'nome' })
        .setDescription('Nome do personagem')
        .setDescriptionLocalizations({ 'pt-BR': 'Nome do personagem' })
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.` })
      return
    }

    const nome = interaction.options.getString('nome', true)

    await interaction.deferReply()

    const res = await waifuService.info({ guildId: interaction.guildId, query: nome })

    if (res.success === false) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} ${res.message}` })
      return
    }

    const c = res.character

    const value = typeof (c as { value?: unknown }).value === 'number' ? ((c as { value: number }).value as number) : null
    const claimed_value = typeof (res as { claimedValue?: unknown }).claimedValue === 'number' ? (res as { claimedValue: number }).claimedValue : null
    const image_url = normalize_http_url(c.imageUrl)

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} ${c.name}`)
      .setDescription(
        `Fonte: **${c.source}**\n` +
          (value !== null ? `Valor: **${value}**\n` : '') +
          (res.claimedByUserId
            ? `Casado com: <@${res.claimedByUserId}>` + (claimed_value !== null ? ` (**${claimed_value}** pts)` : '')
            : 'Status: disponível')
      )

    if (image_url) {
      embed.setImage(image_url)
    }

    await interaction.editReply({ embeds: [embed] })
  },
}
