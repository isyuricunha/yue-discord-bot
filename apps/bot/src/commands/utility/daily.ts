import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'
import { dailyRewardService } from '../../services/dailyReward.service'
import { format_bigint } from '../../utils/bigint'
import { safe_reply_ephemeral } from '../../utils/interaction'

function formatTimeRemaining(targetDate: Date): string {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()

  if (diff <= 0) {
    return '00:00:00'
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const dailyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('diario')
    .setNameLocalizations({ 'pt-BR': 'diario' })
    .setDescription('Receba sua recompensa diária de luazinhas')
    .setDescriptionLocalizations({ 'pt-BR': 'Receba sua recompensa diária de luazinhas' }),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id
    const guildId = interaction.guildId

    if (!guildId) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Use este comando em um servidor.`,
      })
      return
    }

    const config = await dailyRewardService.getGuildConfig(guildId)

    if (!config.enabled) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle(`${EMOJIS.ERROR} Recompensas diárias desativadas`)
        .setDescription('As recompensas diárias estão desativadas neste servidor.')

      await safe_reply_ephemeral(interaction, { embeds: [embed] })
      return
    }

    const result = await dailyRewardService.claimReward(userId, guildId)

    if (!result.success) {
      if ('error' in result && result.error === 'cooldown') {
        const streakInfo = await dailyRewardService.getStreakInfo(userId)
        const config = await dailyRewardService.getGuildConfig(guildId)
        
        const getNextMilestone = (streak: number): { days: number; bonus: string } => {
          const milestones = [7, 14, 21, 30]
          for (const m of milestones) {
            if (streak < m) return { days: m, bonus: format_bigint(BigInt(m) * config.streakBonus) }
          }
          return { days: streak, bonus: format_bigint(BigInt(streak) * config.streakBonus) }
        }
        
        const nextMilestone = getNextMilestone(streakInfo.streakCount)
        
        const embed = new EmbedBuilder()
          .setColor(COLORS.WARNING)
          .setTitle(`${EMOJIS.WARNING} Recompensa já reivindicada`)
          .setDescription(`Você já reivindicou sua recompensa diária!`)
          .addFields([
            {
              name: '🔥 Sequência atual',
              value: `${streakInfo.streakCount} dias`,
              inline: true,
            },
            {
              name: '⭐ Multiplicador',
              value: streakInfo.streakCount > 1 
                ? `${(Math.min(streakInfo.streakCount, config.maxStreakBonus)).toFixed(1)}x`
                : '1.0x',
              inline: true,
            },
            {
              name: 'Próxima recompensa em',
              value: streakInfo.nextClaimAt ? formatTimeRemaining(streakInfo.nextClaimAt) : 'Agora',
              inline: true,
            },
            {
              name: '🎯 Próximo marco',
              value: `${nextMilestone.days} dias (+${nextMilestone.bonus} luazinhas)`,
              inline: true,
            },
            {
              name: 'Total de reinvindicações',
              value: `${streakInfo.totalClaims} dias`,
              inline: true,
            },
          ])

        await safe_reply_ephemeral(interaction, { embeds: [embed] })
        return
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle(`${EMOJIS.ERROR} Erro`)
        .setDescription('Ocorreu um erro ao processar sua recompensa.')

      await safe_reply_ephemeral(interaction, { embeds: [embed] })
      return
    }

    const streakBonusText = result.streakBonus > 0n
      ? `\n+Bônus de sequência: **${format_bigint(result.streakBonus)}** luazinhas`
      : ''

    const streakMultiplier = result.newStreakCount > 1 
      ? (Number(result.streakBonus) / Number(config.rewardAmount) * result.newStreakCount).toFixed(1)
      : '1.0'

    const getNextMilestone = (streak: number): { days: number; bonus: string } => {
      const milestones = [7, 14, 21, 30]
      for (const m of milestones) {
        if (streak < m) return { days: m, bonus: format_bigint(BigInt(m) * config.streakBonus) }
      }
      return { days: streak, bonus: format_bigint(result.streakBonus) }
    }

    const nextMilestone = getNextMilestone(result.newStreakCount)

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Recompensa diária recebida!`)
      .setDescription(`Você ganhou **${format_bigint(result.totalReward)}** luazinhas!${streakBonusText}`)
      .addFields([
        {
          name: '🔥 Sequência atual',
          value: `**${result.newStreakCount} dias**`,
          inline: true,
        },
        {
          name: '⭐ Multiplicador',
          value: `${streakMultiplier}x`,
          inline: true,
        },
        {
          name: 'Recompensa base',
          value: format_bigint(result.rewardAmount),
          inline: true,
        },
        {
          name: 'Bônus de sequência',
          value: format_bigint(result.streakBonus),
          inline: true,
        },
        {
          name: '🎯 Próximo marco',
          value: `${nextMilestone.days} dias (+${nextMilestone.bonus} luazinhas)`,
          inline: true,
        },
        {
          name: 'Total de reinvindicações',
          value: `${result.newTotalClaims} dias`,
          inline: true,
        },
        {
          name: 'Saldo atual',
          value: format_bigint(result.newBalance),
          inline: true,
        },
      ])
      .setFooter({ text: 'Volte em 24 horas para receber novamente!' })

    await safe_reply_ephemeral(interaction, { embeds: [embed] })
  },
}
