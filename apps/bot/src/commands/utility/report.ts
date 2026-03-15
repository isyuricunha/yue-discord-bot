import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'
import { reportLogService } from '../../services/reportLog.service'

export const reportCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Denunciar um usuário para a equipe do servidor')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário a denunciar').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('motivo')
        .setDescription('Motivo da denúncia')
        .setRequired(true)
        .setMaxLength(1500)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
      return
    }

    const reported = interaction.options.getUser('usuario', true)
    const reason = interaction.options.getString('motivo', true).trim()

    if (reason.length === 0) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Motivo inválido.`, ephemeral: true })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    await reportLogService.notify({
      guild: interaction.guild,
      reportedUser: reported,
      reporter: interaction.user,
      reason,
    })

    await interaction.editReply({ content: `${EMOJIS.SUCCESS} Denúncia enviada. Obrigado!` })
  },
}
