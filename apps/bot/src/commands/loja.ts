import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js'
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js'

import { prisma, Prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from './index'
import { shopService } from '../services/shop.service'
import { format_bigint } from '../utils/bigint'

function clamp_autocomplete_name(input: string): string {
  return input.length > 100 ? input.slice(0, 100) : input
}

function parse_quantity(input: number | null): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) return 1
  return Math.max(1, Math.min(50, Math.floor(input)))
}

function format_price(price: bigint): string {
  return format_bigint(price)
}

function kind_label(kind: string): string {
  if (kind === 'xp_boost') return 'XP boost'
  if (kind === 'waifu_reroll_ticket') return 'Ticket de reroll (waifu)'
  if (kind === 'temp_role') return 'Cargo temporário'
  if (kind === 'nick_color') return 'Cor do nick'
  return kind
}

function normalize_hex_color(input: string): string | null {
  const trimmed = input.trim()
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null
  return normalized.toUpperCase()
}

export const lojaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Loja: comprar itens com luazinhas')
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Listar itens disponíveis')
    )
    .addSubcommand((sub) =>
      sub
        .setName('comprar')
        .setDescription('Comprar um item')
        .addStringOption((opt) =>
          opt
            .setName('item_id')
            .setDescription('ID do item na loja')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('quantidade')
            .setDescription('Quantidade (padrão 1)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
        .addStringOption((opt) =>
          opt
            .setName('motivo')
            .setDescription('Motivo (opcional, aparece no ledger)')
            .setRequired(false)
            .setMaxLength(200)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('admin_criar')
        .setDescription('Criar/ativar item na loja (admin)')
        .addStringOption((opt) =>
          opt
            .setName('nome')
            .setDescription('Nome do item')
            .setRequired(true)
            .setMaxLength(64)
        )
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setDescription('Tipo do item')
            .setRequired(true)
            .addChoices(
              { name: 'xp_boost', value: 'xp_boost' },
              { name: 'waifu_reroll_ticket', value: 'waifu_reroll_ticket' },
              { name: 'temp_role', value: 'temp_role' },
              { name: 'nick_color', value: 'nick_color' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('preco')
            .setDescription('Preço em luazinhas (inteiro)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('descricao')
            .setDescription('Descrição (opcional)')
            .setRequired(false)
            .setMaxLength(2000)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('global')
            .setDescription('Se true, o item fica disponível em todos os servidores')
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('stackable')
            .setDescription('Se true, agrega no inventário (quantidade)')
            .setRequired(false)
        )
        .addNumberOption((opt) =>
          opt
            .setName('multiplier')
            .setDescription('Somente xp_boost: multiplicador (ex: 2)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('duracao_minutos')
            .setDescription('Somente xp_boost/temp_role/nick_color: duração em minutos')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(30 * 24 * 60)
        )
        .addRoleOption((opt) =>
          opt
            .setName('cargo')
            .setDescription('Somente temp_role: cargo a aplicar')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('cor')
            .setDescription('Somente nick_color: cor HEX (ex: #ff00aa)')
            .setRequired(false)
            .setMaxLength(16)
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal para preview (somente validação)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true)
    if (focused.name !== 'item_id') {
      await interaction.respond([])
      return
    }

    const query = typeof focused.value === 'string' ? focused.value.trim() : ''

    const where =
      query.length > 0
        ? {
            enabled: true,
            OR: [{ guildId: null }, { guildId: interaction.guildId ?? null }],
            AND: [
              {
                OR: [
                  { id: { contains: query } },
                  { name: { contains: query, mode: 'insensitive' as const } },
                  { kind: { contains: query, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : {
            enabled: true,
            OR: [{ guildId: null }, { guildId: interaction.guildId ?? null }],
          }

    const items = await prisma.shopItem.findMany({
      where,
      orderBy: [{ price: 'asc' }, { name: 'asc' }],
      take: 25,
      select: { id: true, name: true, kind: true, price: true },
    })

    await interaction.respond(
      items.map((i) => ({
        name: clamp_autocomplete_name(`${i.name} (${kind_label(i.kind)}) — ${format_price(i.price)} — ${i.id}`),
        value: i.id,
      }))
    )
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    if (sub === 'listar') {
      await interaction.deferReply({ ephemeral: true })

      const items = await shopService.list_items({ guildId: interaction.guildId ?? null })

      if (items.length === 0) {
        await interaction.editReply({ content: `${EMOJIS.INFO} Nenhum item disponível na loja.` })
        return
      }

      const lines = items.slice(0, 15).map((i) => {
        const scope = i.guildId ? 'guild' : 'global'
        const desc = i.description ? ` — ${i.description}` : ''
        return `\`${i.id}\` — **${i.name}** (${kind_label(i.kind)}) — **${format_price(i.price)}** luazinhas — ${scope}${desc}`
      })

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('🛒 Loja')
        .setDescription(lines.join('\n'))
        .setFooter({ text: items.length > 15 ? `Mostrando 15 de ${items.length}` : `${items.length} item(ns)` })

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'comprar') {
      await interaction.deferReply({ ephemeral: true })

      const item_id = interaction.options.getString('item_id', true).trim()
      const qty = parse_quantity(interaction.options.getInteger('quantidade'))
      const reason = interaction.options.getString('motivo')

      const res = await shopService.purchase({
        userId: interaction.user.id,
        guildId: interaction.guildId ?? null,
        shopItemId: item_id,
        quantity: qty,
        reason,
      })

      if (!res.success) {
        const err = 'error' in res ? res.error : 'item_not_found'
        const msg =
          err === 'insufficient_funds'
            ? 'Saldo insuficiente.'
            : err === 'invalid_quantity'
              ? 'Quantidade inválida.'
              : err === 'item_disabled'
                ? 'Este item está desativado.'
                : err === 'invalid_price'
                  ? 'Preço inválido.'
                  : 'Item não encontrado.'

        await interaction.editReply({ content: `${EMOJIS.ERROR} ${msg}` })
        return
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Compra concluída`) 
        .setDescription(
          `Total: **${format_bigint(res.total)}** luazinhas\n` +
            `Saldo atual: **${format_bigint(res.balance)}** luazinhas\n` +
            `Purchase ID: \`${res.purchaseId}\``
        )

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'admin_criar') {
      if (!interaction.guildId) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
        return
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Você não tem permissão para usar este comando.`, ephemeral: true })
        return
      }

      await interaction.deferReply({ ephemeral: true })

      const name = interaction.options.getString('nome', true).trim()
      const kind = interaction.options.getString('tipo', true)
      const raw_price = interaction.options.getString('preco', true).trim()
      const description = interaction.options.getString('descricao')?.trim() || null

      let price: bigint
      try {
        if (!/^[0-9]+$/.test(raw_price)) throw new Error('invalid')
        price = BigInt(raw_price)
      } catch {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Preço inválido (use um inteiro).` })
        return
      }

      const is_global = interaction.options.getBoolean('global') ?? false
      const stackable = interaction.options.getBoolean('stackable') ?? true
      const multiplier = interaction.options.getNumber('multiplier')
      const duration_minutes = interaction.options.getInteger('duracao_minutos')
      const role = interaction.options.getRole('cargo')
      const color = interaction.options.getString('cor')

      const metadata: Record<string, unknown> = {}

      if (kind === 'xp_boost') {
        if (!(typeof multiplier === 'number' && multiplier > 1)) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Para xp_boost, informe multiplier > 1.` })
          return
        }
        if (!(typeof duration_minutes === 'number' && duration_minutes > 0)) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Para xp_boost, informe duracao_minutos.` })
          return
        }

        metadata.multiplier = multiplier
        metadata.durationMinutes = duration_minutes
      }

      if (kind === 'temp_role') {
        if (!role) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Para temp_role, informe cargo.` })
          return
        }
        if (!(typeof duration_minutes === 'number' && duration_minutes > 0)) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Para temp_role, informe duracao_minutos.` })
          return
        }

        metadata.roleId = role.id
        metadata.durationMinutes = duration_minutes
      }

      if (kind === 'nick_color') {
        const normalized = color ? normalize_hex_color(color) : null
        if (!normalized) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Para nick_color, informe cor HEX (ex: #FF00AA).` })
          return
        }
        if (!(typeof duration_minutes === 'number' && duration_minutes > 0)) {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Para nick_color, informe duracao_minutos.` })
          return
        }

        metadata.durationMinutes = duration_minutes
        metadata.color = normalized
      }

      const created = await prisma.shopItem.create({
        data: {
          guildId: is_global ? null : interaction.guildId,
          name,
          description,
          kind,
          price,
          enabled: true,
          stackable,
          metadata: metadata as Prisma.InputJsonValue,
        },
        select: { id: true },
      })

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Item criado`) 
        .setDescription(`ID: \`${created.id}\`\nNome: **${name}**\nTipo: **${kind}**\nPreço: **${format_price(price)}**`)

      await interaction.editReply({ embeds: [embed] })
      return
    }

    await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
  },
}
