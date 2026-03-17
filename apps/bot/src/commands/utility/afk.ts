import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'
import { setAfk, getAfk, removeAfk } from '../../services/afk.service'
import { safe_reply_ephemeral } from '../../utils/interaction'

export const afkCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setNameLocalizations({ 'pt-BR': 'afk' })
    .setDescription('Set your status as AFK (away from keyboard)')
    .setDescriptionLocalizations({ 'pt-BR': 'Defina seu status como AFK (ausente do teclado)' })
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setNameLocalizations({ 'pt-BR': 'motivo' })
        .setDescription('Reason for being AFK')
        .setDescriptionLocalizations({ 'pt-BR': 'Motivo pelo qual está AFK' })
        .setRequired(false)
        .setMaxLength(500)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id
    const guildId = interaction.guildId

    if (!guildId) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Use este comando em um servidor.`,
      })
      return
    }

    const reason = interaction.options.getString('motivo') || null
    const existingAfk = await getAfk(userId, guildId)

    if (existingAfk && existingAfk.isAfk) {
      const startedAtTimestamp = Math.floor(new Date(existingAfk.startedAt).getTime() / 1000)
      
      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle(`${EMOJIS.WARNING} Você já está AFK`)
        .setDescription(`Você definiu seu status como AFK em <t:${startedAtTimestamp}:f>`)
        .addFields([
          {
            name: 'Motivo',
            value: existingAfk.reason || 'Sem motivo definido',
            inline: false,
          },
        ])
        .setFooter({ text: 'Envie uma mensagem para remover o status AFK automaticamente.' })

      await safe_reply_ephemeral(interaction, { embeds: [embed] })
      return
    }

    await setAfk(userId, guildId, reason)

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Você está agora como AFK!`)
      .setDescription(reason ? `**Motivo:** ${reason}` : 'Você não definiu um motivo.')
      .setFooter({ text: 'Envie uma mensagem para remover o status AFK automaticamente.' })
      .setTimestamp(new Date())

    await safe_reply_ephemeral(interaction, { embeds: [embed] })
  },
}

export const volteiCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('voltei')
    .setNameLocalizations({ 'pt-BR': 'voltei' })
    .setDescription('Remove your AFK status')
    .setDescriptionLocalizations({ 'pt-BR': 'Remove seu status de AFK' }),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id
    const guildId = interaction.guildId

    if (!guildId) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Use este comando em um servidor.`,
      })
      return
    }

    const existingAfk = await getAfk(userId, guildId)

    if (!existingAfk || !existingAfk.isAfk) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Você não está AFK`)
        .setDescription('Você não tem um status de AFK ativo neste servidor.')

      await safe_reply_ephemeral(interaction, { embeds: [embed] })
      return
    }

    await removeAfk(userId, guildId)

    const startedAtTimestamp = Math.floor(new Date(existingAfk.startedAt).getTime() / 1000)
    const durationMs = Date.now() - new Date(existingAfk.startedAt).getTime()
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Bem-vindo de volta!`)
      .setDescription(`Você estava AFK desde <t:${startedAtTimestamp}:f>`)
      .addFields([
        {
          name: 'Duração',
          value: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
          inline: true,
        },
        {
          name: 'Motivo original',
          value: existingAfk.reason || 'Sem motivo definido',
          inline: true,
        },
      ])
      .setTimestamp(new Date())

    await safe_reply_ephemeral(interaction, { embeds: [embed] })
  },
}
