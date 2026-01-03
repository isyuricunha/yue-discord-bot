import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'
import { autoModService } from '../../services/automod.service'
import { welcomeService } from '../../services/welcome.service'
import { moderationLogService } from '../../services/moderationLog.service'

function get_optional_text_channel_id(interaction: ChatInputCommandInteraction, name: string): string | null {
  const channel = interaction.options.getChannel(name)
  if (!channel) return null

  const allowed = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement])
  if (!allowed.has(channel.type)) return null

  return channel.id
}

function clear_guild_config_caches(guild_id: string) {
  autoModService.clearCache(guild_id)
  welcomeService.clear_cache(guild_id)
  moderationLogService.clear_cache(guild_id)
}

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurar o bot neste servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) =>
      group
        .setName('channels')
        .setDescription('Configurar canais do bot')
        .addSubcommand((sub) =>
          sub
            .setName('modlog')
            .setDescription('Definir/limpar canal de modlog')
            .addChannelOption((opt) =>
              opt
                .setName('canal')
                .setDescription('Canal de logs de moderação (omitido = limpar)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('welcome')
            .setDescription('Definir/limpar canal de boas-vindas')
            .addChannelOption((opt) =>
              opt
                .setName('canal')
                .setDescription('Canal de boas-vindas (omitido = limpar)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('leave')
            .setDescription('Definir/limpar canal de saída')
            .addChannelOption((opt) =>
              opt
                .setName('canal')
                .setDescription('Canal de saída (omitido = limpar)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('announcement')
            .setDescription('Definir/limpar canal de anúncios')
            .addChannelOption((opt) =>
              opt
                .setName('canal')
                .setDescription('Canal de anúncios (omitido = limpar)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('giveaway')
            .setDescription('Definir/limpar canal de sorteios')
            .addChannelOption((opt) =>
              opt
                .setName('canal')
                .setDescription('Canal de sorteios (omitido = limpar)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('templates')
        .setDescription('Configurar templates de mensagens')
        .addSubcommand((sub) =>
          sub
            .setName('welcome')
            .setDescription('Definir/limpar template de boas-vindas')
            .addStringOption((opt) =>
              opt
                .setName('template')
                .setDescription('Template (omitido = limpar)')
                .setMaxLength(4000)
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('leave')
            .setDescription('Definir/limpar template de saída')
            .addStringOption((opt) =>
              opt
                .setName('template')
                .setDescription('Template (omitido = limpar)')
                .setMaxLength(4000)
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('modlog')
            .setDescription('Definir/limpar template do modlog')
            .addStringOption((opt) =>
              opt
                .setName('template')
                .setDescription('Template (omitido = limpar)')
                .setMaxLength(4000)
                .setRequired(false)
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
      return
    }

    const group = interaction.options.getSubcommandGroup()
    const sub = interaction.options.getSubcommand()

    await interaction.deferReply({ ephemeral: true })

    const guild_id = interaction.guild.id

    try {
      if (group === 'channels') {
        const channel_id = get_optional_text_channel_id(interaction, 'canal')

        if (sub === 'modlog') {
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { modLogChannelId: channel_id },
            create: { guildId: guild_id, modLogChannelId: channel_id },
          })
        } else if (sub === 'welcome') {
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { welcomeChannelId: channel_id },
            create: { guildId: guild_id, welcomeChannelId: channel_id },
          })
        } else if (sub === 'leave') {
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { leaveChannelId: channel_id },
            create: { guildId: guild_id, leaveChannelId: channel_id },
          })
        } else if (sub === 'announcement') {
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { announcementChannelId: channel_id },
            create: { guildId: guild_id, announcementChannelId: channel_id },
          })
        } else if (sub === 'giveaway') {
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { giveawayChannelId: channel_id },
            create: { guildId: guild_id, giveawayChannelId: channel_id },
          })
        } else {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Subcomando inválido.` })
          return
        }

        clear_guild_config_caches(guild_id)

        const label =
          sub === 'modlog'
            ? 'ModLog'
            : sub === 'welcome'
              ? 'Boas-vindas'
              : sub === 'leave'
                ? 'Saída'
                : sub === 'announcement'
                  ? 'Anúncios'
                  : 'Sorteios'

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Canal atualizado`) 
          .setDescription(`${label}: ${channel_id ? `<#${channel_id}>` : '**(limpo)**'}`)

        await interaction.editReply({ embeds: [embed] })
        return
      }

      if (group === 'templates') {
        const template = interaction.options.getString('template')

        if (sub === 'welcome') {
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { welcomeMessage: template },
            create: { guildId: guild_id, welcomeMessage: template },
          })
        } else if (sub === 'leave') {
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { leaveMessage: template },
            create: { guildId: guild_id, leaveMessage: template },
          })
        } else if (sub === 'modlog') {
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { modLogMessage: template },
            create: { guildId: guild_id, modLogMessage: template },
          })
        } else {
          await interaction.editReply({ content: `${EMOJIS.ERROR} Subcomando inválido.` })
          return
        }

        clear_guild_config_caches(guild_id)

        const label = sub === 'welcome' ? 'Boas-vindas' : sub === 'leave' ? 'Saída' : 'ModLog'

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Template atualizado`)
          .setDescription(`${label}: ${template ? 'atualizado' : '**(limpo)**'}`)

        await interaction.editReply({ embeds: [embed] })
        return
      }

      await interaction.editReply({ content: `${EMOJIS.ERROR} Grupo inválido.` })
    } catch (error) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Erro ao salvar configurações.` })
      throw error
    }
  },
}
