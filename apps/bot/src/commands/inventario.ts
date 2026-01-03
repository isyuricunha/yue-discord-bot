import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from './index'
import { inventoryService } from '../services/inventory.service'

function clamp_autocomplete_name(input: string): string {
  return input.length > 100 ? input.slice(0, 100) : input
}

function format_item_line(item: {
  id: string
  kind: string
  title: string
  quantity: number
  usedQuantity: number
  expiresAt: Date | null
}): string {
  const remaining = Math.max(0, item.quantity - item.usedQuantity)
  const expires = item.expiresAt ? ` — expira <t:${Math.floor(item.expiresAt.getTime() / 1000)}:R>` : ''
  return `\`${item.id}\` — **${item.title}** (${item.kind}) — restante: **${remaining}**/${item.quantity}${expires}`
}

export const inventarioCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('inventario')
    .setDescription('Inventário: ver e usar itens')
    .addSubcommand((sub) => sub.setName('listar').setDescription('Listar itens do seu inventário'))
    .addSubcommand((sub) =>
      sub
        .setName('usar')
        .setDescription('Usar um item do inventário')
        .addStringOption((opt) =>
          opt
            .setName('item_id')
            .setDescription('ID do item no inventário')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true)
    if (focused.name !== 'item_id') {
      await interaction.respond([])
      return
    }

    const query = typeof focused.value === 'string' ? focused.value.trim() : ''

    const rows = await inventoryService.find_usable_for_autocomplete({
      userId: interaction.user.id,
      guildId: interaction.guildId ?? null,
      query,
    })

    await interaction.respond(
      rows.map((r) => ({
        name: clamp_autocomplete_name(`${r.title} (${r.kind}) — ${r.id}`),
        value: r.id,
      }))
    )
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()

    if (sub === 'listar') {
      await interaction.deferReply({ ephemeral: true })

      const rows = await inventoryService.list({ userId: interaction.user.id, guildId: interaction.guildId ?? null })
      if (rows.length === 0) {
        await interaction.editReply({ content: `${EMOJIS.INFO} Seu inventário está vazio.` })
        return
      }

      const lines = rows.slice(0, 15).map((r) =>
        format_item_line({
          id: r.id,
          kind: r.kind,
          title: r.title,
          quantity: r.quantity,
          usedQuantity: r.usedQuantity,
          expiresAt: r.expiresAt,
        })
      )

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('🎒 Inventário')
        .setDescription(lines.join('\n'))
        .setFooter({ text: rows.length > 15 ? `Mostrando 15 de ${rows.length}` : `${rows.length} item(ns)` })

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'usar') {
      if (!interaction.guildId) {
        await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
        return
      }

      await interaction.deferReply({ ephemeral: true })

      const item_id = interaction.options.getString('item_id', true).trim()

      // Routing by kind
      const all = await inventoryService.list({ userId: interaction.user.id, guildId: interaction.guildId })
      const picked = all.find((i) => i.id === item_id)
      if (!picked) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Item não encontrado.` })
        return
      }

      if (picked.kind === 'xp_boost') {
        const res = await inventoryService.activate_xp_boost({ userId: interaction.user.id, guildId: interaction.guildId, inventoryItemId: item_id })
        if (!res.success) {
          const err = 'error' in res ? res.error : 'invalid_metadata'
          await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível ativar este item (${err}).` })
          return
        }

        const expires = res.item.expiresAt ? `<t:${Math.floor(res.item.expiresAt.getTime() / 1000)}:F> (<t:${Math.floor(res.item.expiresAt.getTime() / 1000)}:R>)` : '—'
        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} XP boost ativado`)
          .setDescription(`Expira em: ${expires}`)

        await interaction.editReply({ embeds: [embed] })
        return
      }

      if (picked.kind === 'temp_role') {
        const res = await inventoryService.activate_role({
          userId: interaction.user.id,
          guildId: interaction.guildId,
          inventoryItemId: item_id,
          add_role: async (role_id) => {
            try {
              const member = await interaction.guild?.members.fetch(interaction.user.id)
              if (!member) return false
              await member.roles.add(role_id)
              return true
            } catch {
              return false
            }
          },
        })

        if (!res.success) {
          const err = 'error' in res ? res.error : 'invalid_metadata'
          await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível ativar este item (${err}).` })
          return
        }

        const expires = res.item.expiresAt ? `<t:${Math.floor(res.item.expiresAt.getTime() / 1000)}:F> (<t:${Math.floor(res.item.expiresAt.getTime() / 1000)}:R>)` : '—'
        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Cargo aplicado`)
          .setDescription(`Expira em: ${expires}`)

        await interaction.editReply({ embeds: [embed] })
        return
      }

      if (picked.kind === 'waifu_reroll_ticket') {
        const res = await inventoryService.consume_simple({ userId: interaction.user.id, guildId: interaction.guildId, inventoryItemId: item_id })
        if (!res.success) {
          const err = 'error' in res ? res.error : 'not_found'
          await interaction.editReply({ content: `${EMOJIS.ERROR} Não foi possível usar este item (${err}).` })
          return
        }

        await interaction.editReply({ content: `${EMOJIS.SUCCESS} Ticket consumido. Use /reroll agora.` })
        return
      }

      await interaction.editReply({ content: `${EMOJIS.ERROR} Este item não pode ser usado por aqui ainda.` })
      return
    }

    await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
  },
}
