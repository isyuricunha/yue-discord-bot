import { EmbedBuilder } from 'discord.js'
import type { ButtonInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import { coinflipService } from '../services/coinflip.service'
import { format_bigint } from '../utils/bigint'

function parse_custom_id(custom_id: string): { action: 'accept' | 'decline'; gameId: string } | null {
  const [prefix, action, gameId] = custom_id.split(':')
  if (prefix !== 'coinflip') return null
  if ((action !== 'accept' && action !== 'decline') || !gameId) return null
  return { action, gameId }
}

export async function handleCoinflipButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parse_custom_id(interaction.customId)
  if (!parsed) return

  await interaction.deferReply({ ephemeral: true })

  if (parsed.action === 'decline') {
    const res = await coinflipService.decline_bet({ gameId: parsed.gameId, userId: interaction.user.id })

    if (!res.success) {
      const error = 'error' in res ? res.error : 'not_found'
      const msg =
        error === 'not_found'
          ? 'Aposta não encontrada.'
          : error === 'already_resolved'
            ? 'Esta aposta já foi resolvida.'
            : 'Você não é o desafiante desta aposta.'

      await interaction.editReply({ content: `${EMOJIS.ERROR} ${msg}` })
      return
    }

    await interaction.editReply({ content: `${EMOJIS.SUCCESS} Aposta recusada.` })
    return
  }

  const res = await coinflipService.accept_bet({ gameId: parsed.gameId, userId: interaction.user.id })

  if (!res.success) {
    const error = 'error' in res ? res.error : 'not_found'
    const msg =
      error === 'not_found'
        ? 'Aposta não encontrada.'
        : error === 'already_resolved'
          ? 'Esta aposta já foi resolvida.'
          : error === 'insufficient_funds'
            ? 'Saldo insuficiente para aceitar esta aposta.'
            : 'Você não é o desafiante desta aposta.'

    await interaction.editReply({ content: `${EMOJIS.ERROR} ${msg}` })
    return
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.SUCCESS} Cara ou Coroa resolvido`)
    .setDescription(
      `Resultado: **${res.resultSide === 'heads' ? 'Cara' : 'Coroa'}**\n` +
        `Vencedor: <@${res.winnerId}>\n` +
        `Aposta: **${format_bigint(res.betAmount)}** luazinhas`
    )
    .addFields([
      { name: 'Saldo do vencedor', value: format_bigint(res.winnerBalance), inline: true },
      { name: 'Saldo do perdedor', value: format_bigint(res.loserBalance), inline: true },
      { name: 'Commit (server seed hash)', value: res.serverSeedHash ? `\`${res.serverSeedHash}\`` : 'N/A', inline: false },
      { name: 'Reveal (server seed)', value: res.serverSeed ? `\`${res.serverSeed}\`` : 'N/A', inline: false },
    ])

  await interaction.editReply({ embeds: [embed] })
}
