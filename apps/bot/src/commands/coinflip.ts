import crypto from 'node:crypto'

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import { prisma } from '@yuebot/database'

import type { Command } from './index'
import { coinflipService, type coin_side } from '../services/coinflip.service'
import { luazinhaEconomyService } from '../services/luazinhaEconomy.service'
import { format_bigint } from '../utils/bigint'

function parse_amount(input: string): bigint | null {
  const trimmed = input.trim()
  if (!/^[0-9]+$/.test(trimmed)) return null

  try {
    const value = BigInt(trimmed)
    if (value <= 0n) return null
    return value
  } catch {
    return null
  }
}

function random_side(): coin_side {
  return crypto.randomInt(0, 2) === 0 ? 'heads' : 'tails'
}

function side_label(side: coin_side): string {
  return side === 'heads' ? 'Cara' : 'Coroa'
}

export const coinflipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setNameLocalizations({ 'pt-BR': 'coinflip' })
    .setDescription('Jogar cara ou coroa (com ou sem aposta)')
    .setDescriptionLocalizations({ 'pt-BR': 'Jogar cara ou coroa (com ou sem aposta)' })
    .addSubcommand((sub) =>
      sub
        .setName('flip')
        .setNameLocalizations({ 'pt-BR': 'flip' })
        .setDescription('Girar uma moeda (sem aposta)')
        .setDescriptionLocalizations({ 'pt-BR': 'Girar uma moeda (sem aposta)' })
    )
    .addSubcommand((sub) =>
      sub
        .setName('bet')
        .setNameLocalizations({ 'pt-BR': 'bet' })
        .setDescription('Desafiar alguém para uma aposta')
        .setDescriptionLocalizations({ 'pt-BR': 'Desafiar alguém para uma aposta' })
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Oponente')
            .setDescriptionLocalizations({ 'pt-BR': 'Oponente' })
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('quantia')
            .setNameLocalizations({ 'pt-BR': 'quantia' })
            .setDescription('Quantidade de luazinhas para apostar (cada jogador)')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de luazinhas para apostar (cada jogador)' })
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('lado')
            .setNameLocalizations({ 'pt-BR': 'lado' })
            .setDescription('Seu lado escolhido: cara ou coroa')
            .setDescriptionLocalizations({ 'pt-BR': 'Seu lado escolhido: cara ou coroa' })
            .addChoices(
              { name: 'Cara', value: 'heads' },
              { name: 'Coroa', value: 'tails' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('stats')
        .setNameLocalizations({ 'pt-BR': 'stats' })
        .setDescription('Ver estatísticas de coinflip')
        .setDescriptionLocalizations({ 'pt-BR': 'Ver estatísticas de coinflip' })
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Usuário (opcional)')
            .setDescriptionLocalizations({ 'pt-BR': 'Usuário (opcional)' })
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setNameLocalizations({ 'pt-BR': 'info' })
        .setDescription('Entenda como a aleatoriedade funciona e por que não existe “macete”')
        .setDescriptionLocalizations({ 'pt-BR': 'Entenda como a aleatoriedade funciona e por que não existe “macete”' })
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    if (sub === 'flip') {
      const side = random_side()

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Coinflip`)
        .setDescription(`Resultado: **${side_label(side)}**`)

      await interaction.reply({ embeds: [embed] })
      return
    }

    if (sub === 'info') {
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Coinflip: sobre aleatoriedade`)
        .setDescription(
          'Não existe “macete” confiável para garantir vitória.\n\n' +
            '- O resultado é gerado com aleatoriedade do servidor (não depende de tempo de clique, servidor, ou “esquentar” a moeda).\n' +
            '- Para alguém prever resultados consistentemente, teria que prever a fonte de entropia do servidor — isso é inviável na prática.\n' +
            '- Se alguém parece “ganhar sempre”, geralmente é só variância: em amostras pequenas, sequências improváveis acontecem.'
        )

      await interaction.reply({ embeds: [embed], ephemeral: true })
      return
    }

    if (sub === 'bet') {
      if (!interaction.guildId || !interaction.channelId) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
        return
      }

      const opponent = interaction.options.getUser('usuario', true)
      const raw_amount = interaction.options.getString('quantia', true)
      const side = interaction.options.getString('lado', true) as coin_side

      if (opponent.bot) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Você não pode apostar contra bots.`, ephemeral: true })
        return
      }

      if (opponent.id === interaction.user.id) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Você não pode apostar contra si mesmo.`, ephemeral: true })
        return
      }

      const amount = parse_amount(raw_amount)
      if (!amount) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Quantia inválida.`, ephemeral: true })
        return
      }

      await interaction.deferReply()

      await luazinhaEconomyService.ensure_user(interaction.user.id, {
        username: interaction.user.username,
        avatar: interaction.user.avatar,
      })
      await luazinhaEconomyService.ensure_user(opponent.id, { username: opponent.username, avatar: opponent.avatar })

      const challenger_balance = await luazinhaEconomyService.get_balance(interaction.user.id)
      if (challenger_balance.balance < amount) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Você não tem luazinhas suficientes para essa aposta.` })
        return
      }

      const { gameId } = await coinflipService.create_bet({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageId: null,
        challengerId: interaction.user.id,
        opponentId: opponent.id,
        betAmount: amount,
        challengerSide: side,
      })

      const accept = new ButtonBuilder()
        .setCustomId(`coinflip:accept:${gameId}`)
        .setStyle(ButtonStyle.Success)
        .setLabel('Aceitar')

      const decline = new ButtonBuilder()
        .setCustomId(`coinflip:decline:${gameId}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Recusar')

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(accept, decline)

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Coinflip bet`)
        .setDescription(
          `<@${interaction.user.id}> desafiou <@${opponent.id}> para uma aposta.\n\n` +
            `Quantia: **${format_bigint(amount)}** luazinhas (cada jogador)\n` +
            `Escolha do desafiante: **${side_label(side)}**\n\n` +
            `Oponente: clique em **Aceitar** ou **Recusar**.`
        )

      const reply = await interaction.editReply({
        content: `<@${opponent.id}>`,
        embeds: [embed],
        components: [row],
        allowedMentions: { users: [opponent.id] },
      })

      // store message id for reference
      await prisma.coinflipGame.update({ where: { id: gameId }, data: { messageId: reply.id } })
      return
    }

    if (sub === 'stats') {
      const user = interaction.options.getUser('usuario') ?? interaction.user

      await interaction.deferReply({ ephemeral: true })

      const played = await prisma.coinflipGame.count({
        where: {
          status: 'completed',
          OR: [{ challengerId: user.id }, { opponentId: user.id }],
        },
      })

      const wins = await prisma.coinflipGame.count({ where: { status: 'completed', winnerId: user.id } })
      const losses = Math.max(0, played - wins)

      const wins_sum = await prisma.coinflipGame.aggregate({
        where: { status: 'completed', winnerId: user.id },
        _sum: { betAmount: true },
      })

      const losses_sum = await prisma.coinflipGame.aggregate({
        where: {
          status: 'completed',
          winnerId: { not: user.id },
          OR: [{ challengerId: user.id }, { opponentId: user.id }],
        },
        _sum: { betAmount: true },
      })

      const won = wins_sum._sum.betAmount ?? 0n
      const lost = losses_sum._sum.betAmount ?? 0n
      const net = won - lost

      const win_rate = played > 0 ? (wins / played) * 100 : 0

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Estatísticas de coinflip`)
        .setDescription(`Usuário: <@${user.id}>`)
        .addFields([
          { name: 'Partidas', value: String(played), inline: true },
          { name: 'Vitórias', value: `${wins} (${win_rate.toFixed(2)}%)`, inline: true },
          { name: 'Derrotas', value: `${losses} (${(100 - win_rate).toFixed(2)}%)`, inline: true },
          { name: 'Luazinhas ganhas', value: format_bigint(won), inline: true },
          { name: 'Luazinhas perdidas', value: format_bigint(lost), inline: true },
          { name: 'Total líquido', value: format_bigint(net), inline: true },
        ])
        .setFooter({ text: 'Quanto mais partidas, mais a taxa tende a se aproximar de 50%.' })

      await interaction.editReply({ embeds: [embed] })
      return
    }

    await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
  },
}
