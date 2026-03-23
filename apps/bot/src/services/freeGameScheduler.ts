import { Client, EmbedBuilder } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'
import { getSendableChannel } from '../utils/discord'
import {
  gamerPowerService,
  GAMERPOWER_PLATFORMS,
  GAMERPOWER_TYPES,
  getGiveawayUrl,
  type GamerPowerGiveaway,
} from './gamerpower.service'
import { Queue, Worker, Job } from 'bullmq'
import { get_redis_connection } from './queue.connection'

// ============================================
// Configuration - Scheduler interval (in minutes)
// ============================================

const DEFAULT_CHECK_INTERVAL_MINUTES = 15

// Helper function to safely extract string array from Json field
function extractStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return []
}

/**
 * Normalizes the platforms field from GamerPower API response.
 * Handles cases where platforms might be a string, array, or null/undefined.
 * @param platforms - The platforms field from API response
 * @returns Normalized array of platform strings
 */
function normalizePlatforms(platforms: unknown): string[] {
  // If it's already a valid array, return filtered string array
  if (Array.isArray(platforms)) {
    return platforms.filter(
      (p): p is string => typeof p === 'string'
    )
  }
  // If it's a string, try to parse as JSON or treat as comma-separated
  if (typeof platforms === 'string') {
    try {
      const parsed = JSON.parse(platforms)
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (p): p is string => typeof p === 'string'
        )
      }
    } catch {
      // Treat as comma-separated list
      return platforms.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  // Return empty array for null, undefined, or other types
  return []
}

// ============================================
// Helper Functions - PT-BR localization
// ============================================

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
 * Cria embed para notificação de giveaway
 * @param giveaway - Giveaway da GamerPower
 * @returns Embed formatado
 */
function createNotificationEmbed(giveaway: GamerPowerGiveaway): EmbedBuilder {
  const platforms = normalizePlatforms(giveaway.platforms)
    .map((p) => `${getPlatformEmoji(p)} ${getPlatformName(p)}`)
    .join(' | ')

  const typeEmoji = getTypeEmoji(giveaway.type)
  const typeName = getTypeName(giveaway.type)

  const embed = new EmbedBuilder()
    .setColor(getEmbedColorByType(giveaway.type))
    .setTitle(`${typeEmoji} ${giveaway.title}`)
    .setURL(getGiveawayUrl(giveaway))
    .setDescription(
      giveaway.description.length > 300
        ? giveaway.description.substring(0, 297) + '...'
        : giveaway.description
    )
    .addFields(
      {
        name: '🌐 Plataformas',
        value: platforms || 'Todas',
        inline: false,
      },
      {
        name: '🏷️ Tipo',
        value: typeName,
        inline: true,
      },
      {
        name: '💰 Valor',
        value: giveaway.worth,
        inline: true,
      },
      {
        name: '📅 Termina em',
        value: formatDate(giveaway.end_date),
        inline: true,
      }
    )
    .setThumbnail(giveaway.thumbnail)
    .setFooter({
      text: `🔗 Pegar agora: ${getGiveawayUrl(giveaway)}`,
    })
    .setTimestamp()

  return embed
}

// ============================================
// Scheduler Class
// ============================================

export class FreeGameScheduler {
  private client: Client
  private queue: Queue
  private worker: Worker
  private intervalCheck: NodeJS.Timeout | null = null

  constructor(client: Client) {
    this.client = client

    // Initialize BullMQ queue
    const redis_connection = get_redis_connection()
    this.queue = new Queue('freegame-queue', { connection: redis_connection as any })

    // Create worker for processing jobs
    this.worker = new Worker(
      'freegame-queue',
      async (job: Job) => {
        if (job.name === 'check-giveaways') {
          await this.processGuildNotifications()
        }
      },
      { connection: redis_connection as any }
    )

    this.worker.on('failed', (job, err) => {
      logger.error({ err, jobId: job?.id }, '❌ Erro no Worker do FreeGame Scheduler')
    })
  }

  /**
   * Inicia o scheduler
   * @param intervalMinutes - Intervalo de verificação em minutos (padrão: 15)
   */
  start(intervalMinutes: number = DEFAULT_CHECK_INTERVAL_MINUTES) {
    const intervalMs = intervalMinutes * 60 * 1000

    // Use simple interval for checking (simpler than BullMQ repeat for this use case)
    this.intervalCheck = setInterval(
      () => this.processGuildNotifications().catch((err) => {
        logger.error({ err: safe_error_details(err) }, 'Erro ao processar notificações de jogos grátis')
      }),
      intervalMs
    )

    // Also add initial job to run immediately
    setTimeout(
      () => this.processGuildNotifications().catch((err) => {
        logger.error({ err: safe_error_details(err) }, 'Erro ao processar notificações iniciais de jogos grátis')
      }),
      5000 // Wait 5 seconds after startup before first check
    )

    logger.info(`🎮 FreeGame scheduler iniciado (intervalo: ${intervalMinutes} minutos)`)
  }

  /**
   * Para o scheduler
   */
  async stop() {
    if (this.intervalCheck) {
      clearInterval(this.intervalCheck)
      this.intervalCheck = null
    }
    await this.worker.close()
    await this.queue.close()
    logger.info('🎮 FreeGame scheduler parado')
  }

  /**
   * Processa notificações de jogos grátis para todas as guilds ativadas
   */
  private async processGuildNotifications() {
    try {
      // Buscar todas as guilds com notificações ativadas
      const guildConfigs = await prisma.freeGameNotification.findMany({
        where: {
          isEnabled: true,
          channelId: { not: null },
        },
      })

      if (guildConfigs.length === 0) {
        logger.debug('Nenhuma guild com notificações de jogos grátis ativadas')
        return
      }

      logger.info(`🎮 Verificando jogos grátis para ${guildConfigs.length} guild(s)`)

      // Para cada guild, verificar e notificar
      for (const config of guildConfigs) {
        // Transform raw Prisma config to typed config
        const processedConfig = {
          guildId: config.guildId,
          channelId: config.channelId,
          roleIds: extractStringArray(config.roleIds),
          platforms: extractStringArray(config.platforms),
          giveawayTypes: extractStringArray(config.giveawayTypes),
        }
        await this.processGuild(processedConfig).catch((err) => {
          logger.error(
            { err: safe_error_details(err), guildId: config.guildId },
            'Erro ao processar notificações de jogos grátis para guild'
          )
        })
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao buscar configurações de notificações')
    }
  }

  /**
   * Processa notificações para uma guild específica
   * @param config - Configuração de notificação da guild
   */
  private async processGuild(config: {
    guildId: string
    channelId: string | null
    roleIds: string[]
    platforms: string[]
    giveawayTypes: string[]
  }) {
    if (!config.channelId) {
      logger.warn({ guildId: config.guildId }, 'Guild sem canal configurado para notificações')
      return
    }

    // Buscar giveaways da API
    const giveaways = await gamerPowerService.getAllGiveaways({
      platforms: config.platforms.length > 0 ? config.platforms : undefined,
      types: config.giveawayTypes.length > 0 ? config.giveawayTypes : undefined,
      sortBy: 'date',
    })

    if (giveaways.length === 0) {
      logger.debug({ guildId: config.guildId }, 'Nenhum giveaway encontrado para esta guild')
      return
    }

    // Buscar giveaways já anunciados para esta guild
    const announcedGiveaways = await prisma.freeGameGiveaway.findMany({
      where: { guildId: config.guildId },
      select: { giveawayId: true },
    })

    const announcedIds = new Set(announcedGiveaways.map((g) => String(g.giveawayId)))

    // Filtrar apenas giveaways novos (não anunciados)
    const newGiveaways = giveaways.filter((g) => !announcedIds.has(String(g.id)))

    if (newGiveaways.length === 0) {
      logger.debug({ guildId: config.guildId }, 'Nenhum giveaway novo para esta guild')
      return
    }

    // Buscar canal
    const channel = await this.client.channels.fetch(config.channelId).catch(() => null)
    const sendableChannel = getSendableChannel(channel)

    if (!sendableChannel) {
      logger.warn(
        { guildId: config.guildId, channelId: config.channelId },
        'Canal de notificação não é enviável'
      )
      return
    }

    // Obter cargo(s) para mencionar
    const roleIds = Array.isArray(config.roleIds) ? config.roleIds : []
    const roleMention = roleIds.length > 0 ? roleIds.map((id) => `<@&${id}>`).join(' ') : null

    // Limitar a 3 notificações por execução para evitar spam
    const giveawaysToNotify = newGiveaways.slice(0, 3)

    // Enviar notificações
    for (const giveaway of giveawaysToNotify) {
      try {
        const embed = createNotificationEmbed(giveaway)

        await sendableChannel.send({
          content: roleMention || undefined,
          embeds: [embed],
          allowedMentions: roleIds.length > 0 ? { roles: roleIds } : undefined,
        })

        // Registrar giveaway como anunciado
        await prisma.freeGameGiveaway.create({
          data: {
            giveawayId: String(giveaway.id),
            guildId: config.guildId,
          },
        })

        logger.info(
          { guildId: config.guildId, giveawayId: giveaway.id, title: giveaway.title },
          'Notificação de jogo grátis enviada'
        )

        // Pequeno delay entre mensagens para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        logger.error(
          { err: safe_error_details(error), guildId: config.guildId, giveawayId: giveaway.id },
          'Erro ao enviar notificação de jogo grátis'
        )
      }
    }

    // Atualizar lastCheckedAt
    await prisma.freeGameNotification.update({
      where: { guildId: config.guildId },
      data: { lastCheckedAt: new Date() },
    })

    logger.info(
      { guildId: config.guildId, notifiedCount: giveawaysToNotify.length },
      'Verificação de jogos grátis concluída'
    )
  }
}