import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import { CONFIG } from '../config'

import type { Command } from './index'
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

function format_amount(amount: bigint): string {
  return format_bigint(amount)
}

export const luazinhasCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('luazinhas')
    .setNameLocalizations({ 'pt-BR': 'luazinhas' })
    .setDescription('Economia do Yue: saldo e transferências')
    .setDescriptionLocalizations({ 'pt-BR': 'Economia do Yue: saldo e transferências' })
    .addSubcommand((sub) =>
      sub
        .setName('saldo')
        .setNameLocalizations({ 'pt-BR': 'saldo' })
        .setDescription('Ver seu saldo de luazinhas')
        .setDescriptionLocalizations({ 'pt-BR': 'Ver seu saldo de luazinhas' })
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
        .setName('transferir')
        .setNameLocalizations({ 'pt-BR': 'transferir' })
        .setDescription('Transferir luazinhas para alguém')
        .setDescriptionLocalizations({ 'pt-BR': 'Transferir luazinhas para alguém' })
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Destino')
            .setDescriptionLocalizations({ 'pt-BR': 'Destino' })
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('quantia')
            .setNameLocalizations({ 'pt-BR': 'quantia' })
            .setDescription('Quantidade de luazinhas')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de luazinhas' })
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('motivo')
            .setNameLocalizations({ 'pt-BR': 'motivo' })
            .setDescription('Motivo (opcional)')
            .setDescriptionLocalizations({ 'pt-BR': 'Motivo (opcional)' })
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('admin_add')
        .setNameLocalizations({ 'pt-BR': 'admin_add' })
        .setDescription('Adicionar luazinhas (admin)')
        .setDescriptionLocalizations({ 'pt-BR': 'Adicionar luazinhas (admin)' })
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Usuário')
            .setDescriptionLocalizations({ 'pt-BR': 'Usuário' })
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('quantia')
            .setNameLocalizations({ 'pt-BR': 'quantia' })
            .setDescription('Quantidade de luazinhas')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de luazinhas' })
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('motivo')
            .setNameLocalizations({ 'pt-BR': 'motivo' })
            .setDescription('Motivo (opcional)')
            .setDescriptionLocalizations({ 'pt-BR': 'Motivo (opcional)' })
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('admin_remove')
        .setNameLocalizations({ 'pt-BR': 'admin_remove' })
        .setDescription('Remover luazinhas (admin)')
        .setDescriptionLocalizations({ 'pt-BR': 'Remover luazinhas (admin)' })
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Usuário')
            .setDescriptionLocalizations({ 'pt-BR': 'Usuário' })
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('quantia')
            .setNameLocalizations({ 'pt-BR': 'quantia' })
            .setDescription('Quantidade de luazinhas')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de luazinhas' })
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('motivo')
            .setNameLocalizations({ 'pt-BR': 'motivo' })
            .setDescription('Motivo (opcional)')
            .setDescriptionLocalizations({ 'pt-BR': 'Motivo (opcional)' })
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    if (sub === 'saldo') {
      const user = interaction.options.getUser('usuario') ?? interaction.user
      await luazinhaEconomyService.ensure_user(user.id, { username: user.username, avatar: user.avatar })

      const { balance } = await luazinhaEconomyService.get_balance(user.id)

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Saldo de luazinhas`)
        .setDescription(`<@${user.id}> tem **${format_amount(balance)}** luazinhas.`)

      await interaction.reply({ embeds: [embed], ephemeral: true })
      return
    }

    if (sub === 'transferir') {
      if (!interaction.guildId) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
        return
      }

      const to_user = interaction.options.getUser('usuario', true)
      const raw_amount = interaction.options.getString('quantia', true)
      const reason = interaction.options.getString('motivo')

      const amount = parse_amount(raw_amount)
      if (!amount) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Quantia inválida.`, ephemeral: true })
        return
      }

      if (to_user.bot) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Você não pode transferir para bots.`, ephemeral: true })
        return
      }

      await interaction.deferReply({ ephemeral: true })

      await luazinhaEconomyService.ensure_user(interaction.user.id, {
        username: interaction.user.username,
        avatar: interaction.user.avatar,
      })
      await luazinhaEconomyService.ensure_user(to_user.id, { username: to_user.username, avatar: to_user.avatar })

      const result = await luazinhaEconomyService.transfer({
        from_user_id: interaction.user.id,
        to_user_id: to_user.id,
        amount,
        guild_id: interaction.guildId,
        reason,
      })

      if (!result.success) {
        const error = 'error' in result ? result.error : 'invalid_amount'
        const msg =
          error === 'insufficient_funds'
            ? 'Saldo insuficiente.'
            : error === 'same_user'
              ? 'Você não pode transferir para si mesmo.'
              : 'Quantia inválida.'

        await interaction.editReply({ content: `${EMOJIS.ERROR} ${msg}` })
        return
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Transferência concluída`)
        .setDescription(`Você enviou **${format_amount(amount)}** luazinhas para <@${to_user.id}>.`)
        .addFields([
          { name: 'Seu saldo', value: format_amount(result.fromBalance), inline: true },
          { name: 'Saldo do destino', value: format_amount(result.toBalance), inline: true },
        ])

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'admin_add' || sub === 'admin_remove') {
      if (!interaction.guildId) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
        return
      }

      const allowlist = CONFIG.admin.ownerUserIds
      if (!Array.isArray(allowlist) || allowlist.length === 0) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} Este comando está desativado (OWNER_USER_IDS não configurado).`,
          ephemeral: true,
        })
        return
      }

      if (!allowlist.includes(interaction.user.id)) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} Você não tem permissão para usar este comando.`,
          ephemeral: true,
        })
        return
      }

      const target = interaction.options.getUser('usuario', true)
      const raw_amount = interaction.options.getString('quantia', true)
      const reason = interaction.options.getString('motivo')

      const amount = parse_amount(raw_amount)
      if (!amount) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Quantia inválida.`, ephemeral: true })
        return
      }

      await interaction.deferReply({ ephemeral: true })

      await luazinhaEconomyService.ensure_user(target.id, { username: target.username, avatar: target.avatar })

      const res =
        sub === 'admin_add'
          ? await luazinhaEconomyService.admin_add({ to_user_id: target.id, amount, guild_id: interaction.guildId, reason })
          : await luazinhaEconomyService.admin_remove({ from_user_id: target.id, amount, guild_id: interaction.guildId, reason })

      if (!res.success) {
        const error = 'error' in res ? res.error : 'invalid_amount'
        const msg = error === 'insufficient_funds' ? 'Saldo insuficiente para remover.' : 'Quantia inválida.'
        await interaction.editReply({ content: `${EMOJIS.ERROR} ${msg}` })
        return
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Saldo atualizado`)
        .setDescription(`<@${target.id}> agora tem **${format_amount(res.balance)}** luazinhas.`)

      await interaction.editReply({ embeds: [embed] })
      return
    }

    await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
  },
}
