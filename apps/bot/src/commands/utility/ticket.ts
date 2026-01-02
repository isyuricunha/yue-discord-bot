import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'
import { ticketService } from '../../services/ticket.service'

function optional_channel_id(
  interaction: ChatInputCommandInteraction,
  name: string,
  allowed: ChannelType[]
): string | null {
  const channel = interaction.options.getChannel(name)
  if (!channel) return null
  if (!allowed.includes(channel.type)) return null
  return channel.id
}

function optional_role_ids(interaction: ChatInputCommandInteraction, name: string): string[] {
  const roles = interaction.options.getRole(name)
  if (!roles) return []
  return [roles.id]
}

export const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Configurar sistema de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Criar/atualizar painel de tickets')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal onde o painel será enviado')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('categoria')
            .setDescription('Categoria onde os canais de ticket serão criados (opcional)')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName('log')
            .setDescription('Canal de logs de tickets (opcional)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName('cargo_suporte')
            .setDescription('Cargo de suporte com acesso aos tickets (opcional)')
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('ativar')
            .setDescription('Ativar tickets neste servidor')
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
      return
    }

    const sub = interaction.options.getSubcommand()
    if (sub !== 'setup') {
      await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
      return
    }

    const enable = interaction.options.getBoolean('ativar')

    const panel_channel = interaction.options.getChannel('canal', true)
    if (panel_channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Canal inválido.`, ephemeral: true })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    const category_id = optional_channel_id(interaction, 'categoria', [ChannelType.GuildCategory])
    const log_channel_id = optional_channel_id(interaction, 'log', [ChannelType.GuildText])

    const existing = await ticketService.get_config(interaction.guild.id)

    const supportRoleIds = optional_role_ids(interaction, 'cargo_suporte')
    const merged_support_roles = Array.from(new Set([...(existing.supportRoleIds ?? []), ...supportRoleIds])).slice(0, 20)

    const enabled = enable ?? true

    await ticketService.setup_panel({
      guild_id: interaction.guild.id,
      enabled,
      panelChannelId: panel_channel.id,
      categoryId: category_id ?? existing.categoryId,
      logChannelId: log_channel_id ?? existing.logChannelId,
      supportRoleIds: merged_support_roles,
    })

    const fresh = await ticketService.get_config(interaction.guild.id)

    const ensured = await ticketService.ensure_panel_message(interaction.guild, panel_channel.id, fresh.panelMessageId)
    await ticketService.set_panel_message_id(interaction.guild.id, { panelMessageId: ensured.messageId })

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Tickets configurados`) 
      .setDescription(
        `Painel: <#${panel_channel.id}>\n` +
          `Ativo: **${enabled ? 'sim' : 'não'}**\n` +
          (fresh.categoryId ? `Categoria: <#${fresh.categoryId}>\n` : '') +
          (fresh.logChannelId ? `Logs: <#${fresh.logChannelId}>\n` : '') +
          (fresh.supportRoleIds.length > 0 ? `Suporte: ${fresh.supportRoleIds.map((id) => `<@&${id}>`).join(', ')}\n` : '')
      )

    await interaction.editReply({ embeds: [embed] })
  },
}
