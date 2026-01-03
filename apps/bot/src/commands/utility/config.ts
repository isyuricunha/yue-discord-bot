import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS, warnThresholdsSchema } from '@yuebot/shared'

import type { Command } from '../index'
import { autoModService } from '../../services/automod.service'
import { welcomeService } from '../../services/welcome.service'
import { moderationLogService } from '../../services/moderationLog.service'
import { xpService } from '../../services/xp.service'

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

function normalize_string_array(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

function normalize_banned_words(value: unknown): Array<{ word: string; action: string }> {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => {
      if (!v || typeof v !== 'object') return null
      const obj = v as { word?: unknown; action?: unknown }
      const word = typeof obj.word === 'string' ? obj.word.trim() : ''
      const action = typeof obj.action === 'string' ? obj.action.trim() : ''
      if (!word || !action) return null
      return { word, action }
    })
    .filter((v): v is { word: string; action: string } => Boolean(v))
}

function normalize_warn_thresholds(value: unknown) {
  const parsed = warnThresholdsSchema.safeParse(value)
  if (!parsed.success) return []
  return parsed.data
}

function is_duration(value: string) {
  return /^\d+[smhd]$/.test(value)
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
    )
    .addSubcommandGroup((group) =>
      group
        .setName('automod')
        .setDescription('Configurar AutoMod')
        .addSubcommand((sub) =>
          sub
            .setName('word')
            .setDescription('Ativar/desativar filtro de palavras')
            .addBooleanOption((opt) =>
              opt.setName('ativar').setDescription('Ativar filtro de palavras').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('word-add')
            .setDescription('Adicionar palavra proibida')
            .addStringOption((opt) => opt.setName('palavra').setDescription('Palavra/regex').setRequired(true).setMaxLength(200))
            .addStringOption((opt) =>
              opt
                .setName('acao')
                .setDescription('Ação a aplicar')
                .setRequired(true)
                .addChoices(
                  { name: 'Deletar', value: 'delete' },
                  { name: 'Warn', value: 'warn' },
                  { name: 'Mute', value: 'mute' },
                  { name: 'Kick', value: 'kick' },
                  { name: 'Ban', value: 'ban' }
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('word-remove')
            .setDescription('Remover palavra proibida')
            .addStringOption((opt) => opt.setName('palavra').setDescription('Palavra/regex exata').setRequired(true).setMaxLength(200))
        )
        .addSubcommand((sub) =>
          sub
            .setName('word-list')
            .setDescription('Listar palavras proibidas')
        )
        .addSubcommand((sub) =>
          sub
            .setName('caps')
            .setDescription('Configurar filtro de CAPS')
            .addBooleanOption((opt) => opt.setName('ativar').setDescription('Ativar filtro de caps').setRequired(true))
            .addIntegerOption((opt) => opt.setName('threshold').setDescription('Percentual (0-100)').setMinValue(0).setMaxValue(100).setRequired(false))
            .addIntegerOption((opt) => opt.setName('min_len').setDescription('Tamanho mínimo').setMinValue(1).setMaxValue(4000).setRequired(false))
            .addStringOption((opt) =>
              opt
                .setName('acao')
                .setDescription('Ação a aplicar')
                .setRequired(false)
                .addChoices(
                  { name: 'Warn', value: 'warn' },
                  { name: 'Mute (5m)', value: 'mute' },
                  { name: 'Kick', value: 'kick' }
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('link')
            .setDescription('Configurar filtro de links')
            .addBooleanOption((opt) => opt.setName('ativar').setDescription('Ativar filtro de links').setRequired(true))
            .addBooleanOption((opt) => opt.setName('block_all').setDescription('Bloquear todos os links').setRequired(false))
            .addStringOption((opt) =>
              opt
                .setName('acao')
                .setDescription('Ação a aplicar')
                .setRequired(false)
                .addChoices(
                  { name: 'Deletar', value: 'delete' },
                  { name: 'Warn', value: 'warn' },
                  { name: 'Mute', value: 'mute' },
                  { name: 'Kick', value: 'kick' },
                  { name: 'Ban', value: 'ban' }
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('domain-add')
            .setDescription('Adicionar domínio banido')
            .addStringOption((opt) => opt.setName('dominio').setDescription('Ex: example.com').setRequired(true).setMaxLength(200))
        )
        .addSubcommand((sub) =>
          sub
            .setName('domain-remove')
            .setDescription('Remover domínio banido')
            .addStringOption((opt) => opt.setName('dominio').setDescription('Ex: example.com').setRequired(true).setMaxLength(200))
        )
        .addSubcommand((sub) =>
          sub
            .setName('domain-list')
            .setDescription('Listar domínios banidos')
        )
        .addSubcommand((sub) =>
          sub
            .setName('warn-expiration')
            .setDescription('Definir expiração de warns (dias)')
            .addIntegerOption((opt) => opt.setName('dias').setDescription('Dias (>=1)').setMinValue(1).setMaxValue(3650).setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('warn-threshold-add')
            .setDescription('Adicionar threshold de warns')
            .addIntegerOption((opt) => opt.setName('warns').setDescription('Quantidade de warns').setMinValue(1).setMaxValue(1000).setRequired(true))
            .addStringOption((opt) =>
              opt
                .setName('acao')
                .setDescription('Ação ao atingir warns')
                .setRequired(true)
                .addChoices(
                  { name: 'Mute', value: 'mute' },
                  { name: 'Kick', value: 'kick' },
                  { name: 'Ban', value: 'ban' }
                )
            )
            .addStringOption((opt) =>
              opt
                .setName('duracao')
                .setDescription('Duração (somente mute), ex: 5m, 1h')
                .setRequired(false)
                .setMaxLength(10)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('warn-threshold-remove')
            .setDescription('Remover threshold de warns')
            .addIntegerOption((opt) => opt.setName('warns').setDescription('Quantidade de warns').setMinValue(1).setMaxValue(1000).setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('warn-threshold-list')
            .setDescription('Listar thresholds de warns')
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('xp')
        .setDescription('Configurar sistema de XP')
        .addSubcommand((sub) =>
          sub
            .setName('enabled')
            .setDescription('Ativar/desativar XP')
            .addBooleanOption((opt) => opt.setName('ativar').setDescription('Ativar XP').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('params')
            .setDescription('Ajustar parâmetros do XP')
            .addIntegerOption((opt) => opt.setName('min_msg').setDescription('Min message length').setMinValue(0).setMaxValue(4000).setRequired(false))
            .addIntegerOption((opt) => opt.setName('min_unique').setDescription('Min unique length').setMinValue(0).setMaxValue(4000).setRequired(false))
            .addIntegerOption((opt) => opt.setName('typing_cps').setDescription('Typing cps').setMinValue(1).setMaxValue(100).setRequired(false))
            .addIntegerOption((opt) => opt.setName('div_min').setDescription('XP divisor min').setMinValue(1).setMaxValue(1000).setRequired(false))
            .addIntegerOption((opt) => opt.setName('div_max').setDescription('XP divisor max').setMinValue(1).setMaxValue(1000).setRequired(false))
            .addIntegerOption((opt) => opt.setName('cap').setDescription('XP cap').setMinValue(1).setMaxValue(10000).setRequired(false))
            .addStringOption((opt) =>
              opt
                .setName('reward_mode')
                .setDescription('Modo de reward (stack|highest)')
                .setRequired(false)
                .addChoices(
                  { name: 'Stack', value: 'stack' },
                  { name: 'Highest', value: 'highest' }
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('ignore-channel-add')
            .setDescription('Ignorar canal para XP')
            .addChannelOption((opt) => opt.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('ignore-channel-remove')
            .setDescription('Remover canal ignorado')
            .addChannelOption((opt) => opt.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        )
        .addSubcommand((sub) => sub.setName('ignore-channel-list').setDescription('Listar canais ignorados'))
        .addSubcommand((sub) =>
          sub
            .setName('ignore-role-add')
            .setDescription('Ignorar cargo para XP')
            .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('ignore-role-remove')
            .setDescription('Remover cargo ignorado')
            .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo').setRequired(true))
        )
        .addSubcommand((sub) => sub.setName('ignore-role-list').setDescription('Listar cargos ignorados'))
        .addSubcommand((sub) =>
          sub
            .setName('levelup-channel')
            .setDescription('Definir/limpar canal de level up')
            .addChannelOption((opt) =>
              opt
                .setName('canal')
                .setDescription('Canal (omitido = limpar)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('levelup-message')
            .setDescription('Definir/limpar template de level up')
            .addStringOption((opt) => opt.setName('template').setDescription('Template (omitido = limpar)').setMaxLength(4000).setRequired(false))
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

      if (group === 'automod') {
        const config_row = await prisma.guildConfig.findUnique({ where: { guildId: guild_id } })

        if (sub === 'word') {
          const enabled = interaction.options.getBoolean('ativar', true)
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { wordFilterEnabled: enabled },
            create: { guildId: guild_id, wordFilterEnabled: enabled },
          })
          clear_guild_config_caches(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} AutoMod atualizado`)
            .setDescription(`Filtro de palavras: **${enabled ? 'ativado' : 'desativado'}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'word-add') {
          const word = interaction.options.getString('palavra', true).trim()
          const action = interaction.options.getString('acao', true)

          const existing = normalize_banned_words(config_row?.bannedWords)
          const next = existing.filter((e) => e.word !== word)
          next.push({ word, action })

          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { bannedWords: next },
            create: { guildId: guild_id, bannedWords: next },
          })
          clear_guild_config_caches(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} Palavra adicionada`)
            .setDescription(`\`${word}\` -> **${action}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'word-remove') {
          const word = interaction.options.getString('palavra', true).trim()
          const existing = normalize_banned_words(config_row?.bannedWords)
          const next = existing.filter((e) => e.word !== word)

          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { bannedWords: next },
            create: { guildId: guild_id, bannedWords: next },
          })
          clear_guild_config_caches(guild_id)

          const removed = existing.length !== next.length
          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} Palavra removida`)
            .setDescription(removed ? `Removida: \`${word}\`` : `Nada para remover: \`${word}\``)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'word-list') {
          const existing = normalize_banned_words(config_row?.bannedWords)

          const lines = existing.slice(0, 30).map((e) => `- \`${e.word}\` -> **${e.action}**`).join('\n')
          const more = existing.length > 30 ? `\n... e mais ${existing.length - 30}` : ''

          const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('📄 Palavras proibidas')
            .setDescription(existing.length === 0 ? 'Nenhuma palavra configurada.' : `${lines}${more}`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'caps') {
          const enabled = interaction.options.getBoolean('ativar', true)
          const threshold = interaction.options.getInteger('threshold')
          const min_len = interaction.options.getInteger('min_len')
          const action = interaction.options.getString('acao')

          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: {
              capsEnabled: enabled,
              ...(threshold !== null ? { capsThreshold: threshold } : {}),
              ...(min_len !== null ? { capsMinLength: min_len } : {}),
              ...(action ? { capsAction: action } : {}),
            },
            create: {
              guildId: guild_id,
              capsEnabled: enabled,
              ...(threshold !== null ? { capsThreshold: threshold } : {}),
              ...(min_len !== null ? { capsMinLength: min_len } : {}),
              ...(action ? { capsAction: action } : {}),
            },
          })

          clear_guild_config_caches(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} AutoMod CAPS atualizado`)
            .setDescription(`Ativo: **${enabled ? 'sim' : 'não'}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'link') {
          const enabled = interaction.options.getBoolean('ativar', true)
          const block_all = interaction.options.getBoolean('block_all')
          const action = interaction.options.getString('acao')

          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: {
              linkFilterEnabled: enabled,
              ...(block_all !== null ? { linkBlockAll: block_all } : {}),
              ...(action ? { linkAction: action } : {}),
            },
            create: {
              guildId: guild_id,
              linkFilterEnabled: enabled,
              ...(block_all !== null ? { linkBlockAll: block_all } : {}),
              ...(action ? { linkAction: action } : {}),
            },
          })

          clear_guild_config_caches(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} AutoMod links atualizado`)
            .setDescription(`Ativo: **${enabled ? 'sim' : 'não'}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'domain-add' || sub === 'domain-remove' || sub === 'domain-list') {
          const existing = normalize_string_array(config_row?.bannedDomains)

          if (sub === 'domain-list') {
            const lines = existing.slice(0, 40).map((d) => `- \`${d}\``).join('\n')
            const more = existing.length > 40 ? `\n... e mais ${existing.length - 40}` : ''

            const embed = new EmbedBuilder()
              .setColor(COLORS.INFO)
              .setTitle('📄 Domínios banidos')
              .setDescription(existing.length === 0 ? 'Nenhum domínio configurado.' : `${lines}${more}`)
            await interaction.editReply({ embeds: [embed] })
            return
          }

          const domain = interaction.options.getString('dominio', true).trim().toLowerCase()
          const deduped = new Set(existing.map((d) => d.toLowerCase()))

          if (sub === 'domain-add') deduped.add(domain)
          if (sub === 'domain-remove') deduped.delete(domain)

          const next = Array.from(deduped).slice(0, 200)

          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { bannedDomains: next },
            create: { guildId: guild_id, bannedDomains: next },
          })

          clear_guild_config_caches(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} Domínios atualizados`)
            .setDescription(`Total: **${next.length}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'warn-expiration') {
          const days = interaction.options.getInteger('dias', true)
          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { warnExpiration: days },
            create: { guildId: guild_id, warnExpiration: days },
          })
          clear_guild_config_caches(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} Warn expiration atualizado`)
            .setDescription(`Expiração: **${days} dia(s)**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'warn-threshold-add') {
          const warns = interaction.options.getInteger('warns', true)
          const action = interaction.options.getString('acao', true) as 'mute' | 'kick' | 'ban'
          const duration_raw = interaction.options.getString('duracao')

          const duration = duration_raw ? duration_raw.trim() : null

          if (action === 'mute' && duration && !is_duration(duration)) {
            await interaction.editReply({ content: `${EMOJIS.ERROR} Duração inválida. Use formato: 5m, 1h, 2d...` })
            return
          }

          if (action !== 'mute' && duration) {
            await interaction.editReply({ content: `${EMOJIS.ERROR} Duração só faz sentido para mute.` })
            return
          }

          const existing = normalize_warn_thresholds(config_row?.warnThresholds)
          const next = existing.filter((t) => t.warns !== warns)
          next.push({ warns, action, ...(action === 'mute' && duration ? { duration } : {}) })
          next.sort((a, b) => a.warns - b.warns)

          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { warnThresholds: next },
            create: { guildId: guild_id, warnThresholds: next },
          })
          clear_guild_config_caches(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} Threshold adicionado`)
            .setDescription(`${warns} warns -> **${action}**${duration ? ` (${duration})` : ''}`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'warn-threshold-remove') {
          const warns = interaction.options.getInteger('warns', true)
          const existing = normalize_warn_thresholds(config_row?.warnThresholds)
          const next = existing.filter((t) => t.warns !== warns)

          await prisma.guildConfig.upsert({
            where: { guildId: guild_id },
            update: { warnThresholds: next },
            create: { guildId: guild_id, warnThresholds: next },
          })
          clear_guild_config_caches(guild_id)

          const removed = existing.length !== next.length
          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} Threshold removido`)
            .setDescription(removed ? `Removido: **${warns}**` : `Nada para remover: **${warns}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'warn-threshold-list') {
          const existing = normalize_warn_thresholds(config_row?.warnThresholds)
          const lines = existing
            .slice(0, 30)
            .map((t) => `- **${t.warns}** -> **${t.action}**${t.duration ? ` (${t.duration})` : ''}`)
            .join('\n')

          const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('📄 Warn thresholds')
            .setDescription(existing.length === 0 ? 'Nenhum threshold configurado.' : lines)

          await interaction.editReply({ embeds: [embed] })
          return
        }

        await interaction.editReply({ content: `${EMOJIS.ERROR} Subcomando inválido.` })
        return
      }

      if (group === 'xp') {
        const xp_row = await prisma.guildXpConfig.findUnique({ where: { guildId: guild_id } })

        if (sub === 'enabled') {
          const enabled = interaction.options.getBoolean('ativar', true)
          await prisma.guildXpConfig.upsert({
            where: { guildId: guild_id },
            update: { enabled },
            create: { guildId: guild_id, enabled },
          })

          xpService.clear_cache(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} XP atualizado`)
            .setDescription(`XP: **${enabled ? 'ativado' : 'desativado'}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'params') {
          const min_msg = interaction.options.getInteger('min_msg')
          const min_unique = interaction.options.getInteger('min_unique')
          const typing_cps = interaction.options.getInteger('typing_cps')
          const div_min = interaction.options.getInteger('div_min')
          const div_max = interaction.options.getInteger('div_max')
          const cap = interaction.options.getInteger('cap')
          const reward_mode = interaction.options.getString('reward_mode')

          await prisma.guildXpConfig.upsert({
            where: { guildId: guild_id },
            update: {
              ...(min_msg !== null ? { minMessageLength: min_msg } : {}),
              ...(min_unique !== null ? { minUniqueLength: min_unique } : {}),
              ...(typing_cps !== null ? { typingCps: typing_cps } : {}),
              ...(div_min !== null ? { xpDivisorMin: div_min } : {}),
              ...(div_max !== null ? { xpDivisorMax: div_max } : {}),
              ...(cap !== null ? { xpCap: cap } : {}),
              ...(reward_mode ? { rewardMode: reward_mode } : {}),
            },
            create: {
              guildId: guild_id,
              ...(min_msg !== null ? { minMessageLength: min_msg } : {}),
              ...(min_unique !== null ? { minUniqueLength: min_unique } : {}),
              ...(typing_cps !== null ? { typingCps: typing_cps } : {}),
              ...(div_min !== null ? { xpDivisorMin: div_min } : {}),
              ...(div_max !== null ? { xpDivisorMax: div_max } : {}),
              ...(cap !== null ? { xpCap: cap } : {}),
              ...(reward_mode ? { rewardMode: reward_mode } : {}),
            },
          })

          xpService.clear_cache(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} XP params atualizados`)
            .setDescription('Parâmetros atualizados com sucesso.')
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'ignore-channel-add' || sub === 'ignore-channel-remove' || sub === 'ignore-channel-list') {
          const existing = normalize_string_array(xp_row?.ignoredChannelIds)

          if (sub === 'ignore-channel-list') {
            const lines = existing.slice(0, 40).map((id) => `- <#${id}>`).join('\n')
            const more = existing.length > 40 ? `\n... e mais ${existing.length - 40}` : ''
            const embed = new EmbedBuilder()
              .setColor(COLORS.INFO)
              .setTitle('📄 XP canais ignorados')
              .setDescription(existing.length === 0 ? 'Nenhum canal ignorado.' : `${lines}${more}`)
            await interaction.editReply({ embeds: [embed] })
            return
          }

          const channel = interaction.options.getChannel('canal', true)
          const id = channel.id
          const set = new Set(existing)
          if (sub === 'ignore-channel-add') set.add(id)
          else set.delete(id)

          const next = Array.from(set).slice(0, 200)
          await prisma.guildXpConfig.upsert({
            where: { guildId: guild_id },
            update: { ignoredChannelIds: next },
            create: { guildId: guild_id, ignoredChannelIds: next },
          })

          xpService.clear_cache(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} XP canais ignorados atualizados`)
            .setDescription(`Total: **${next.length}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'ignore-role-add' || sub === 'ignore-role-remove' || sub === 'ignore-role-list') {
          const existing = normalize_string_array(xp_row?.ignoredRoleIds)

          if (sub === 'ignore-role-list') {
            const lines = existing.slice(0, 40).map((id) => `- <@&${id}>`).join('\n')
            const more = existing.length > 40 ? `\n... e mais ${existing.length - 40}` : ''
            const embed = new EmbedBuilder()
              .setColor(COLORS.INFO)
              .setTitle('📄 XP cargos ignorados')
              .setDescription(existing.length === 0 ? 'Nenhum cargo ignorado.' : `${lines}${more}`)
            await interaction.editReply({ embeds: [embed] })
            return
          }

          const role = interaction.options.getRole('cargo', true)
          const id = role.id
          const set = new Set(existing)
          if (sub === 'ignore-role-add') set.add(id)
          else set.delete(id)

          const next = Array.from(set).slice(0, 200)
          await prisma.guildXpConfig.upsert({
            where: { guildId: guild_id },
            update: { ignoredRoleIds: next },
            create: { guildId: guild_id, ignoredRoleIds: next },
          })

          xpService.clear_cache(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} XP cargos ignorados atualizados`)
            .setDescription(`Total: **${next.length}**`)
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'levelup-channel') {
          const channel_id = get_optional_text_channel_id(interaction, 'canal')
          await prisma.guildXpConfig.upsert({
            where: { guildId: guild_id },
            update: { levelUpChannelId: channel_id },
            create: { guildId: guild_id, levelUpChannelId: channel_id },
          })

          xpService.clear_cache(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} XP level up channel atualizado`)
            .setDescription(channel_id ? `<#${channel_id}>` : '**(limpo)**')
          await interaction.editReply({ embeds: [embed] })
          return
        }

        if (sub === 'levelup-message') {
          const template = interaction.options.getString('template')
          await prisma.guildXpConfig.upsert({
            where: { guildId: guild_id },
            update: { levelUpMessage: template },
            create: { guildId: guild_id, levelUpMessage: template },
          })

          xpService.clear_cache(guild_id)

          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJIS.SUCCESS} XP level up template atualizado`)
            .setDescription(template ? 'atualizado' : '**(limpo)**')
          await interaction.editReply({ embeds: [embed] })
          return
        }

        await interaction.editReply({ content: `${EMOJIS.ERROR} Subcomando inválido.` })
        return
      }

      await interaction.editReply({ content: `${EMOJIS.ERROR} Grupo inválido.` })
    } catch (error) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Erro ao salvar configurações.` })
      throw error
    }
  },
}
