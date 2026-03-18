import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS, BANK } from '@yuebot/shared'

import type { Command } from '../index'
import { luazinhaEconomyService } from '../../services/luazinhaEconomy.service'
import { format_bigint } from '../../utils/bigint'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction'

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

function format_amount(amount: bigint): string {
  return format_bigint(amount)
}

function format_percentage(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

const BANK_EMOJI = '🏦'
const MONEY_EMOJI = '💰'

export const bancoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('banco')
    .setNameLocalizations({ 'pt-BR': 'banco' })
    .setDescription('Banco do Yue: deposite, saque e ganhe juros')
    .setDescriptionLocalizations({ 'pt-BR': 'Banco do Yue: deposite, saque e ganhe juros' })
    .addSubcommand((sub) =>
      sub
        .setName('ver')
        .setNameLocalizations({ 'pt-BR': 'ver' })
        .setDescription('Ver saldo do banco e juros')
        .setDescriptionLocalizations({ 'pt-BR': 'Ver saldo do banco e juros' })
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
        .setName('depositar')
        .setNameLocalizations({ 'pt-BR': 'depositar' })
        .setDescription('Depositar luazinhas no banco')
        .setDescriptionLocalizations({ 'pt-BR': 'Depositar luazinhas no banco' })
        .addStringOption((opt) =>
          opt
            .setName('quantia')
            .setNameLocalizations({ 'pt-BR': 'quantia' })
            .setDescription('Quantidade de luazinhas (use "tudo" para depositar tudo)')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de luazinhas (use "tudo" para depositar tudo)' })
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('sacar')
        .setNameLocalizations({ 'pt-BR': 'sacar' })
        .setDescription('Sacar luazinhas do banco')
        .setDescriptionLocalizations({ 'pt-BR': 'Sacar luazinhas do banco' })
        .addStringOption((opt) =>
          opt
            .setName('quantia')
            .setNameLocalizations({ 'pt-BR': 'quantia' })
            .setDescription('Quantidade de luazinhas (use "tudo" para sacar tudo)')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de luazinhas (use "tudo" para sacar tudo)' })
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setNameLocalizations({ 'pt-BR': 'info' })
        .setDescription('Informações sobre o sistema de juros')
        .setDescriptionLocalizations({ 'pt-BR': 'Informações sobre o sistema de juros' })
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    // Ver informações do banco
    if (sub === 'info') {
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${BANK_EMOJI} Informações do Banco`)
        .setDescription('O banco do Yue permite que suas luazinhas cresçam com juros!')
        .addFields(
          {
            name: 'Taxa de Juros',
            value: format_percentage(BANK.DEFAULT_INTEREST_RATE),
            inline: true,
          },
          {
            name: 'Saldo Mínimo para Juros',
            value: format_amount(BANK.MINIMUM_BALANCE_FOR_INTEREST),
            inline: true,
          },
          {
            name: 'Intervalo de Juros',
            value: `A cada ${BANK.INTEREST_INTERVAL_HOURS} horas`,
            inline: true,
          },
          {
            name: 'Como funciona',
            value:
              '1. Deposite luazinhas no banco usando `/banco depositar`\n' +
              '2. Seu saldo no banco gera juros automaticamente\n' +
              '3. Luazinhas no banco são protegidas de perdas\n' +
              '4. Saque quando precisar usando `/banco sacar`',
          }
        )

      await safe_reply_ephemeral(interaction, { embeds: [embed] })
      return
    }

    // Ver saldo do banco
    if (sub === 'ver') {
      const user = interaction.options.getUser('usuario') ?? interaction.user
      await luazinhaEconomyService.ensure_user(user.id, { username: user.username, avatar: user.avatar })

      const fullBalance = await luazinhaEconomyService.get_full_balance(user.id)

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${BANK_EMOJI} Banco de ${user.username}`)
        .addFields(
          {
            name: `${MONEY_EMOJI} Carteira`,
            value: format_amount(fullBalance.balance),
            inline: true,
          },
          {
            name: `${BANK_EMOJI} Banco`,
            value: format_amount(fullBalance.bankBalance),
            inline: true,
          },
          {
            name: 'Total',
            value: format_amount(fullBalance.balance + fullBalance.bankBalance),
            inline: true,
          },
          {
            name: 'Juros Totais Recebidos',
            value: format_amount(fullBalance.totalInterestEarned),
            inline: false,
          }
        )

      await safe_reply_ephemeral(interaction, { embeds: [embed] })
      return
    }

    // Depositar
    if (sub === 'depositar') {
      if (!interaction.guildId) {
        await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Use este comando em um servidor.` })
        return
      }

      const raw_amount = interaction.options.getString('quantia', true)

      await safe_defer_ephemeral(interaction)

      await luazinhaEconomyService.ensure_user(interaction.user.id, {
        username: interaction.user.username,
        avatar: interaction.user.avatar,
      })

      let amount: bigint

      if (raw_amount.toLowerCase() === 'tudo' || raw_amount.toLowerCase() === 'all') {
        const fullBalance = await luazinhaEconomyService.get_full_balance(interaction.user.id)
        amount = fullBalance.balance

        if (amount <= 0n) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Você não tem luazinhas para depositar.` })
          return
        }
      } else {
        amount = parse_amount(raw_amount)
        if (!amount) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Quantia inválida.` })
          return
        }
      }

      const result = await luazinhaEconomyService.deposit({
        user_id: interaction.user.id,
        amount,
        guild_id: interaction.guildId,
      })

      if (!result.success) {
        const msg = 'error' in result && result.error === 'insufficient_funds' ? 'Saldo insuficiente.' : 'Quantia inválida.'

        await interaction.editReply({ content: `${EMOJIS.ERROR} ${msg}` })
        return
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Depósito realizado`)
        .setDescription(`Você depositou **${format_amount(amount)}** luazinhas no banco.`)
        .addFields(
          { name: 'Novo saldo da carteira', value: format_amount(result.walletBalance), inline: true },
          { name: 'Novo saldo do banco', value: format_amount(result.bankBalance), inline: true }
        )
        .setFooter({ text: 'Suas luazinhas no banco agora rendem juros!' })

      await interaction.editReply({ embeds: [embed] })
      return
    }

    // Sacar
    if (sub === 'sacar') {
      if (!interaction.guildId) {
        await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Use este comando em um servidor.` })
        return
      }

      const raw_amount = interaction.options.getString('quantia', true)

      await safe_defer_ephemeral(interaction)

      await luazinhaEconomyService.ensure_user(interaction.user.id, {
        username: interaction.user.username,
        avatar: interaction.user.avatar,
      })

      let amount: bigint

      if (raw_amount.toLowerCase() === 'tudo' || raw_amount.toLowerCase() === 'all') {
        const fullBalance = await luazinhaEconomyService.get_full_balance(interaction.user.id)
        amount = fullBalance.bankBalance

        if (amount <= 0n) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Você não tem luazinhas no banco para sacar.` })
          return
        }
      } else {
        amount = parse_amount(raw_amount)
        if (!amount) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Quantia inválida.` })
          return
        }
      }

      const result = await luazinhaEconomyService.withdraw({
        user_id: interaction.user.id,
        amount,
        guild_id: interaction.guildId,
      })

      if (!result.success) {
        const msg = 'error' in result && result.error === 'insufficient_funds' ? 'Saldo do banco insuficiente.' : 'Quantia inválida.'

        await interaction.editReply({ content: `${EMOJIS.ERROR} ${msg}` })
        return
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Saque realizado`)
        .setDescription(`Você sacou **${format_amount(amount)}** luazinhas do banco.`)
        .addFields(
          { name: 'Novo saldo da carteira', value: format_amount(result.walletBalance), inline: true },
          { name: 'Novo saldo do banco', value: format_amount(result.bankBalance), inline: true }
        )

      await interaction.editReply({ embeds: [embed] })
      return
    }

    await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Subcomando inválido.` })
  },
}
