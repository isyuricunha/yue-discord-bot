import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'
import { reportLogService } from '../../services/reportLog.service'
import { RateLimiter } from '../../utils/rate_limiter'
import { logger } from '../../utils/logger'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction'

const report_rate_limiter = new RateLimiter({ windowMs: 30_000, max: 1 })

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
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Use este comando em um servidor.` })
      return
    }

    const reported = interaction.options.getUser('usuario', true)
    const reason = interaction.options.getString('motivo', true).trim()

    if (reported.id === interaction.user.id) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Você não pode se denunciar.` })
      return
    }

    if (reported.bot) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Você não pode denunciar bots.` })
      return
    }

    if (reason.length < 10) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Forneça um motivo mais detalhado (mínimo 10 caracteres).`,
      })
      return
    }

    const rate_key = `${interaction.guildId}:${interaction.user.id}`
    const rate = report_rate_limiter.tryConsume(rate_key)
    if (!rate.allowed) {
      const seconds = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Você está fazendo denúncias rápido demais. Tente novamente em ~${seconds}s.`,
      })
      return
    }

    const config = await reportLogService.get_public_config(interaction.guildId)
    if (!config.reportChannelId) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Denúncias não estão configuradas neste servidor. Peça para um admin configurar em /config channels report.`,
      })
      return
    }

    await safe_defer_ephemeral(interaction)

    await reportLogService.notify({
      guild: interaction.guild,
      reportedUser: reported,
      reporter: interaction.user,
      reason,
    })

    logger.info({
      guildId: interaction.guildId,
      reporterId: interaction.user.id,
      reportedUserId: reported.id,
      source: 'slash',
    }, 'Report enviado')

    await interaction.editReply({ content: `${EMOJIS.SUCCESS} Denúncia enviada. Obrigado!` })
  },
}
