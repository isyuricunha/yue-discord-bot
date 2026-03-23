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
import {
  gamerPowerService,
  GAMERPOWER_PLATFORMS,
  GAMERPOWER_TYPES,
  type GamerPowerGiveaway,
} from '../../services/gamerpower.service'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction'

/**
 * Converte string separada por vírgulas em array de strings
 * @param value - String separada por vírgulas
 * @returns Array de strings trimmed
 */
function parseCommaSeparatedString(value: string | null): string[] {
  if (!value || value.trim() === '') return []
  return value
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Valida se a plataforma é válida
 * @param platform - ID da plataforma
 * @returns True se válida
 */
function isValidPlatform(platform: string): boolean {
  return GAMERPOWER_PLATFORMS.some((p) => p.id === platform)
}

/**
 * Valida se o tipo é válido
 * @param type - ID do tipo
 * @returns True se válido
 */
function isValidType(type: string): boolean {
  return GAMERPOWER_TYPES.some((t) => t.id === type)
}

/**
 * Obtém o emoji da plataforma
 * @param platform - ID da plataforma
 * @returns Emoji da plataforma
 */
function getPlatformEmoji(platform: string): string {
  const platformMap: Record<string, string> = {
    steam: '🎮',
    'epic-games-store': '🛒',
    gog: '🎯',
    'itch.io': '🎨',
    xbox: '❌',
    'xbox-series-xs': '❌',
    ps4: '🎮',
    ps5: '🎮',
    android: '📱',
    ios: '🍎',
    switch: '🔄',
    vr: '🥽',
    ubisoft: '🏰',
    battlenet: '🛡️',
    origin: '🚀',
    'drm-free': '📖',
  }
  return platformMap[platform] || '🎮'
}

/**
 * Obtém a cor do embed baseada no tipo
 * @param type - Tipo do giveaway
 * @returns Cor do embed
 */
function getEmbedColorByType(type: string): number {
  const colorMap: Record<string, number> = {
    game: COLORS.INFO,
    loot: COLORS.SUCCESS,
    beta: COLORS.WARNING,
  }
  return colorMap[type] || COLORS.INFO
}

/**
 * Cria embed para um giveaway
 * @param giveaway - Giveaway da GamerPower
 * @returns Embed formatado
 */
function createGiveawayEmbed(giveaway: GamerPowerGiveaway): EmbedBuilder {
  const platforms = giveaway.platforms
    .map((p) => `${getPlatformEmoji(p)} ${getPlatformName(p)}`)
    .join(' | ')

  const typeEmoji = getTypeEmoji(giveaway.type)
  const typeName = getTypeName(giveaway.type)

  const embed = new EmbedBuilder()
    .setColor(getEmbedColorByType(giveaway.type))
    .setTitle(`${typeEmoji} ${giveaway.title}`)
    .setURL(giveaway.giveaway_url)
    .setDescription(
      giveaway.description.length > 300
        ? giveaway.description.substring(0, 297) + '...'
        : giveaway.description
    )
    .addFields(
      {
        name: '💰 Valor',
        value: giveaway.worth,
        inline: true,
      },
      {
        name: '🏷️ Tipo',
        value: typeName,
        inline: true,
      },
      {
        name: '🌐 Plataformas',
        value: platforms || 'Todas',
        inline: false,
      }
    )
    .setThumbnail(giveaway.thumbnail)
    .setFooter({
      text: `ID: ${giveaway.id} • Ends: ${formatDate(giveaway.end_date)}`,
    })

  return embed
}

/**
 * Obtém o nome da plataforma em PT-BR
 * @param platformId - ID da plataforma
 * @returns Nome da plataforma em PT-BR
 */
function getPlatformName(platformId: string): string {
  const platform = GAMERPOWER_PLATFORMS.find((p) => p.id === platformId)
  return platform?.namePtBr || platformId
}

/**
 * Obtém o nome do tipo em PT-BR
 * @param typeId - ID do tipo
 * @returns Nome do tipo em PT-BR
 */
function getTypeName(typeId: string): string {
  const type = GAMERPOWER_TYPES.find((t) => t.id === typeId)
  return type?.namePtBr || typeId
}

/**
 * Obtém o emoji do tipo
 * @param typeId - ID do tipo
 * @returns Emoji do tipo
 */
function getTypeEmoji(typeId: string): string {
  const emojiMap: Record<string, string> = {
    game: '🎮',
    loot: '🎁',
    beta: '🧪',
  }
  return emojiMap[typeId] || '🎁'
}

/**
 * Formata a data para DD/MM/YYYY
 * @param dateString - Data em string
 * @returns Data formatada
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR')
  } catch {
    return dateString
  }
}

/**
 * Converte array de roles em string formatada
 * @param roleIds - Array de IDs de roles
 * @returns String formatada com menções
 */
function formatRoles(roleIds: string[]): string {
  if (roleIds.length === 0) return 'Nenhum cargo configurado'
  return roleIds.map((id) => `<@&${id}>`).join(', ')
}

/**
 * Converte platforms array em string formatada
 * @param platforms - Array de plataformas
 * @return String formatada
 */
function formatPlatforms(platforms: string[]): string {
  if (platforms.length === 0) return 'Todas as plataformas'
  return platforms.map((p) => getPlatformName(p)).join(', ')
}

/**
 * Converte tipos em string formatada
 * @param types - Array de tipos
 * @return String formatada
 */
function formatTypes(types: string[]): string {
  if (types.length === 0) return 'Todos os tipos'
  return types.map((t) => getTypeName(t)).join(', ')
}

export const jogosGratisCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('jogosgratis')
    .setDescription('Gerenciar notificações de jogos grátis')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('configurar')
        .setDescription('Configurar notificações de jogos grátis')
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal para enviar notificações')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt.setName('cargo').setDescription('Cargo para mencionar (vários)')
        )
        .addStringOption((opt) =>
          opt
            .setName('plataformas')
            .setDescription('Plataformas separadas por vírgula (ex: steam,epic-games-store)')
        )
        .addStringOption((opt) =>
          opt
            .setName('tipos')
            .setDescription('Tipos separados por vírgula (ex: game,loot)')
        )
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Ver configuração atual')
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Listar jogos grátis ativos')
        .addStringOption((opt) =>
          opt
            .setName('plataformas')
            .setDescription('Filtrar por plataformas (ex: steam,epic-games-store)')
        )
        .addStringOption((opt) =>
          opt.setName('tipos').setDescription('Filtrar por tipos (ex: game,loot)')
        )
        .addIntegerOption((opt) =>
          opt
            .setName('limite')
            .setDescription('Número de resultados (padrão: 5, máximo: 10)')
            .setMinValue(1)
            .setMaxValue(10)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Use este comando em um servidor.`,
      })
      return
    }

    const sub = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    await safe_defer_ephemeral(interaction)

    try {
      if (sub === 'configurar') {
        await handleConfigurar(interaction, guildId)
        return
      }

      if (sub === 'status') {
        await handleStatus(interaction, guildId)
        return
      }

      if (sub === 'listar') {
        await handleListar(interaction)
        return
      }

      await interaction.editReply({
        content: `${EMOJIS.ERROR} Subcomando inválido.`,
      })
    } catch (error) {
      console.error('jogosgratis command error:', error)
      await interaction.editReply({
        content: `${EMOJIS.ERROR} Erro ao executar o comando.`,
      })
      throw error
    }
  },
}

/**
 * Handler para o subcomando configurar
 */
async function handleConfigurar(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const channel = interaction.options.getChannel('canal', true)
  const role = interaction.options.getRole('cargo')
  const plataformasStr = interaction.options.getString('plataformas')
  const tiposStr = interaction.options.getString('tipos')

  // Validar plataformas
  const plataformas = parseCommaSeparatedString(plataformasStr)
  const invalidPlatforms = plataformas.filter((p) => !isValidPlatform(p))
  if (invalidPlatforms.length > 0) {
    const validPlatforms = GAMERPOWER_PLATFORMS.map((p) => p.id).join(', ')
    await interaction.editReply({
      content: `${EMOJIS.ERROR} Plataforma(s) inválida(s): ${invalidPlatforms.join(', ')}. Plataformas válidas: ${validPlatforms}`,
    })
    return
  }

  // Validar tipos
  const tipos = parseCommaSeparatedString(tiposStr)
  const invalidTypes = tipos.filter((t) => !isValidType(t))
  if (invalidTypes.length > 0) {
    const validTypes = GAMERPOWER_TYPES.map((t) => t.id).join(', ')
    await interaction.editReply({
      content: `${EMOJIS.ERROR} Tipo(s) inválido(s): ${invalidTypes.join(', ')}. Tipos válidos: ${validTypes}`,
    })
    return
  }

  // Criar/atualizar configuração
  const roleIds = role ? [role.id] : []

  await prisma.freeGameNotification.upsert({
    where: { guildId },
    update: {
      channelId: channel.id,
      roleIds,
      platforms: plataformas,
      giveawayTypes: tipos,
      isEnabled: true,
    },
    create: {
      guildId,
      channelId: channel.id,
      roleIds,
      platforms: plataformas,
      giveawayTypes: tipos,
      isEnabled: true,
    },
  })

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.SUCCESS} Configuração salva`)
    .addFields(
      {
        name: '📢 Canal',
        value: `<#${channel.id}>`,
        inline: true,
      },
      {
        name: '👤 Cargo mencionado',
        value: role ? `<@&${role.id}>` : 'Nenhum',
        inline: true,
      },
      {
        name: '🌐 Plataformas',
        value: formatPlatforms(plataformas),
        inline: false,
      },
      {
        name: '🏷️ Tipos',
        value: formatTypes(tipos),
        inline: false,
      }
    )

  await interaction.editReply({ embeds: [embed] })
}

/**
 * Handler para o subcomando status
 */
async function handleStatus(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const config = await prisma.freeGameNotification.findUnique({
    where: { guildId },
  })

  if (!config || !config.channelId) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle('⚠️ Nenhuma configuração encontrada')
      .setDescription(
        'Use `/jogosgratis configurar` para configurar as notificações.'
      )

    await interaction.editReply({ embeds: [embed] })
    return
  }

  const channel = interaction.guild?.channels.cache.get(config.channelId)

  // Helper function to safely extract string array from Json field
  function extractStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string')
    }
    return []
  }

  const roleIds = extractStringArray(config.roleIds)
  const platforms = extractStringArray(config.platforms)
  const giveawayTypes = extractStringArray(config.giveawayTypes)

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('📋 Configuração atual')
    .addFields(
      {
        name: '📢 Canal',
        value: channel ? `<#${config.channelId}>` : `\`${config.channelId}\``,
        inline: true,
      },
      {
        name: '🔔 Status',
        value: config.isEnabled ? '✅ Ativado' : '❌ Desativado',
        inline: true,
      },
      {
        name: '👤 Cargos mencionados',
        value: formatRoles(roleIds),
        inline: false,
      },
      {
        name: '🌐 Plataformas',
        value: formatPlatforms(platforms),
        inline: false,
      },
      {
        name: '🏷️ Tipos',
        value: formatTypes(giveawayTypes),
        inline: false,
      }
    )
    .setFooter({
      text: config.lastCheckedAt
        ? `Última verificação: ${formatDate(config.lastCheckedAt.toISOString())}`
        : 'Nunca verificado',
    })

  await interaction.editReply({ embeds: [embed] })
}

/**
 * Handler para o subcomando listar
 */
async function handleListar(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const plataformasStr = interaction.options.getString('plataformas')
  const tiposStr = interaction.options.getString('tipos')
  const limite = interaction.options.getInteger('limite') || 5

  // Validar plataformas
  const plataformas = parseCommaSeparatedString(plataformasStr)
  const invalidPlatforms = plataformas.filter((p) => !isValidPlatform(p))
  if (invalidPlatforms.length > 0) {
    const validPlatforms = GAMERPOWER_PLATFORMS.map((p) => p.id).join(', ')
    await interaction.editReply({
      content: `${EMOJIS.ERROR} Plataforma(s) inválida(s): ${invalidPlatforms.join(', ')}. Plataformas válidas: ${validPlatforms}`,
    })
    return
  }

  // Validar tipos
  const tipos = parseCommaSeparatedString(tiposStr)
  const invalidTypes = tipos.filter((t) => !isValidType(t))
  if (invalidTypes.length > 0) {
    const validTypes = GAMERPOWER_TYPES.map((t) => t.id).join(', ')
    await interaction.editReply({
      content: `${EMOJIS.ERROR} Tipo(s) inválido(s): ${invalidTypes.join(', ')}. Tipos válidos: ${validTypes}`,
    })
    return
  }

  // Buscar giveaways
  const giveaways = await gamerPowerService.getAllGiveaways({
    platforms: plataformas.length > 0 ? plataformas : undefined,
    types: tipos.length > 0 ? tipos : undefined,
    sortBy: 'date',
  })

  if (giveaways.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle('🎮 Nenhum jogo grátis encontrado')
      .setDescription(
        'Não há jogos grátis disponíveis no momento com os filtros selecionados.'
      )
      .addFields(
        {
          name: 'Filtros aplicados',
          value: `Plataformas: ${formatPlatforms(plataformas)}\nTipos: ${formatTypes(tipos)}`,
          inline: false,
        }
      )

    await interaction.editReply({ embeds: [embed] })
    return
  }

  // Limitar resultados
  const limitedGiveaways = giveaways.slice(0, limite)

  // Criar embeds para cada jogo
  const embeds = limitedGiveaways.map((g) => createGiveawayEmbed(g))

  // Adicionar embed de resumo no início
  const totalValue = giveaways.reduce((acc, g) => {
    const value = parseFloat(g.worth.replace(/[^0-9.]/g, '') || '0')
    return acc + value
  }, 0)

  const summaryEmbed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('🎮 Jogos Grátis Ativos')
    .setDescription(
      `Encontrados **${giveaways.length}** jogos grátis disponíveis!`
    )
    .addFields(
      {
        name: '📊 Total de jogos encontrados',
        value: `${giveaways.length}`,
        inline: true,
      },
      {
        name: '💰 Valor total estimado',
        value: `$${totalValue.toFixed(2)}`,
        inline: true,
      },
      {
        name: '🌐 Plataformas',
        value: plataformas.length > 0 ? plataformas.join(', ') : 'Todas',
        inline: false,
      },
      {
        name: '🏷️ Tipos',
        value: tipos.length > 0 ? tipos.join(', ') : 'Todos',
        inline: false,
      }
    )
    .setFooter({
      text: `Exibindo ${limitedGiveaways.length} de ${giveaways.length} resultados`,
    })

  await interaction.editReply({
    embeds: [summaryEmbed, ...embeds],
  })
}