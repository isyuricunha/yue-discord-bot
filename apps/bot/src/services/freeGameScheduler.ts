import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS } from '@yuebot/shared'

import { normalize_http_url } from '../utils/http_url'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'
import { enqueue_discord_delivery, reopen_discord_delivery } from './discordDelivery.service'
import {
  GAMERPOWER_PLATFORMS,
  GAMERPOWER_TYPES,
  gamerPowerService,
  getGiveawayUrl,
  type GamerPowerGiveaway,
} from './gamerpower.service'

const DEFAULT_CHECK_INTERVAL_MINUTES = 15
const FAILED_DELIVERY_REOPEN_COOLDOWN_MS = 60 * 60 * 1000
const MAX_NOTIFICATIONS_PER_GUILD_PER_CYCLE = 3

type guild_free_game_summary = {
  catalogCount: number
  matchedCount: number
  newCount: number
  queuedCount: number
  reopenedCount: number
  pendingCount: number
  deliveredCount: number
  failedCount: number
  legacyAnnouncedCount: number
}

type giveaway_candidate = {
  giveaway: GamerPowerGiveaway
  mode: 'new' | 'reopen'
}

function empty_summary(catalog_count: number): guild_free_game_summary {
  return {
    catalogCount: catalog_count,
    matchedCount: 0,
    newCount: 0,
    queuedCount: 0,
    reopenedCount: 0,
    pendingCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    legacyAnnouncedCount: 0,
  }
}

function extractStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return []
}

function normalizePlatforms(platforms: unknown): string[] {
  if (Array.isArray(platforms)) {
    return platforms.filter((p): p is string => typeof p === 'string')
  }

  if (typeof platforms === 'string') {
    try {
      const parsed = JSON.parse(platforms)
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === 'string')
      }
    } catch {
      return platforms.split(',').map((value) => value.trim()).filter(Boolean)
    }
  }

  return []
}

function canonicalPlatformId(platform: string): string {
  const normalized = platform.trim().toLowerCase().replace(/\s+/g, ' ')
  const aliases: Record<string, string> = {
    pc: 'pc',
    steam: 'steam',
    'epic games': 'epic-games-store',
    'epic games store': 'epic-games-store',
    'epic-games-store': 'epic-games-store',
    gog: 'gog',
    'itch.io': 'itch.io',
    itchio: 'itch.io',
    xbox: 'xbox',
    'xbox one': 'xbox',
    'xbox-one': 'xbox',
    'xbox series x/s': 'xbox-series-xs',
    'xbox series x|s': 'xbox-series-xs',
    'xbox-series-xs': 'xbox-series-xs',
    ps4: 'ps4',
    'playstation 4': 'ps4',
    ps5: 'ps5',
    'playstation 5': 'ps5',
    switch: 'switch',
    'nintendo switch': 'switch',
    android: 'android',
    ios: 'ios',
    vr: 'vr',
    ubisoft: 'ubisoft',
    'ubisoft connect': 'ubisoft',
    battlenet: 'battlenet',
    'battle.net': 'battlenet',
    origin: 'origin',
    'ea origin': 'origin',
    'drm-free': 'drm-free',
    'drm free': 'drm-free',
  }

  return aliases[normalized] ?? normalized
}

function canonicalGiveawayType(type: unknown): string {
  return String(type ?? '').trim().toLowerCase()
}

export function matchesGuildGiveawayFilters(
  giveaway: GamerPowerGiveaway,
  config: { platforms: string[]; giveawayTypes: string[] },
): boolean {
  const configured_platforms = new Set(config.platforms.map(canonicalPlatformId))
  const giveaway_platforms = normalizePlatforms(giveaway.platforms).map(canonicalPlatformId)
  const platform_matches =
    configured_platforms.size === 0 ||
    giveaway_platforms.some((platform) => configured_platforms.has(platform))

  const configured_types = new Set(config.giveawayTypes.map(canonicalGiveawayType))
  const type_matches =
    configured_types.size === 0 ||
    configured_types.has(canonicalGiveawayType(giveaway.type))

  return platform_matches && type_matches
}

function getPlatformEmoji(platform: string): string {
  const platformMap: Record<string, string> = {
    pc: '🖥️',
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
  return platformMap[canonicalPlatformId(platform)] || '🎮'
}

function getPlatformName(platformId: string): string {
  const canonical_id = canonicalPlatformId(platformId)
  if (canonical_id === 'pc') return 'PC'
  const platform = GAMERPOWER_PLATFORMS.find((item) => item.id === canonical_id)
  return platform?.namePtBr || platformId
}

function getTypeName(typeId: string): string {
  const canonical_type = canonicalGiveawayType(typeId)
  const type = GAMERPOWER_TYPES.find((item) => item.id === canonical_type)
  return type?.namePtBr || typeId
}

function getTypeEmoji(typeId: string): string {
  const emojiMap: Record<string, string> = {
    game: '🎮',
    loot: '🎁',
    beta: '🧪',
  }
  return emojiMap[canonicalGiveawayType(typeId)] || '🎁'
}

function getEmbedColorByType(type: string): number {
  const colorMap: Record<string, number> = {
    game: COLORS.INFO,
    loot: COLORS.SUCCESS,
    beta: COLORS.WARNING,
  }
  return colorMap[canonicalGiveawayType(type)] || COLORS.INFO
}

function formatDate(dateString: string): string {
  if (!dateString || dateString === 'N/A' || dateString === 'Indefinido') return 'Indefinido'
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString
    return date.toLocaleDateString('pt-BR')
  } catch {
    return dateString
  }
}

function createNotificationEmbed(giveaway: GamerPowerGiveaway): EmbedBuilder {
  const platforms = normalizePlatforms(giveaway.platforms)
    .map((platform) => `${getPlatformEmoji(platform)} ${getPlatformName(platform)}`)
    .join(' | ')

  const typeEmoji = getTypeEmoji(giveaway.type)
  const typeName = getTypeName(giveaway.type)
  const url = getGiveawayUrl(giveaway)
  const image_url = normalize_http_url(giveaway.image)

  const embed = new EmbedBuilder()
    .setColor(getEmbedColorByType(giveaway.type))
    .setTitle(`${typeEmoji} ${giveaway.title}`)
    .setURL(url)
    .setDescription(
      (giveaway.description.length > 250
        ? `${giveaway.description.substring(0, 247)}...`
        : giveaway.description) + `\n\n🔗 **[Acessar a Página do Jogo](${url})**`,
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
      },
    )
    .setTimestamp()

  if (image_url) embed.setImage(image_url)
  return embed
}

function delivery_key(guild_id: string, giveaway_id: string | number): string {
  return `free-game:${guild_id}:${giveaway_id}`
}

export class FreeGameScheduler {
  private intervalCheck: NodeJS.Timeout | null = null
  private running = false

  constructor(_client: Client) {}

  start(intervalMinutes: number = DEFAULT_CHECK_INTERVAL_MINUTES) {
    const intervalMs = intervalMinutes * 60 * 1000
    if (this.intervalCheck) return

    this.intervalCheck = setInterval(() => void this.run_once(), intervalMs)
    setTimeout(() => void this.run_once(), 5000)

    logger.info(`🎮 FreeGame scheduler iniciado (intervalo: ${intervalMinutes} minutos)`)
  }

  async stop() {
    if (this.intervalCheck) {
      clearInterval(this.intervalCheck)
      this.intervalCheck = null
    }
    logger.info('🎮 FreeGame scheduler parado')
  }

  private async run_once() {
    if (this.running) return
    this.running = true
    try {
      await this.processGuildNotifications()
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao processar notificações de jogos grátis')
    } finally {
      this.running = false
    }
  }

  private async processGuildNotifications() {
    try {
      const guildConfigs = await prisma.freeGameNotification.findMany({
        where: {
          isEnabled: true,
          channelId: { not: null },
        },
      })

      if (guildConfigs.length === 0) {
        logger.info('🎮 Nenhuma guild com notificações de jogos grátis ativadas')
        return
      }

      logger.info(`🎮 Verificando jogos grátis para ${guildConfigs.length} guild(s)`)

      const catalog = await gamerPowerService.getAllGiveaways({ sortBy: 'date' })
      if (catalog.length === 0) {
        logger.warn({ guildCount: guildConfigs.length }, '🎮 GamerPower não retornou giveaways ativos')
        return
      }

      logger.info(
        { guildCount: guildConfigs.length, catalogCount: catalog.length },
        '🎮 Catálogo de jogos grátis carregado',
      )

      const cycle = empty_summary(catalog.length)
      let failedGuildCount = 0

      for (const config of guildConfigs) {
        const processedConfig = {
          guildId: config.guildId,
          channelId: config.channelId,
          roleIds: extractStringArray(config.roleIds),
          platforms: extractStringArray(config.platforms),
          giveawayTypes: extractStringArray(config.giveawayTypes),
        }

        try {
          const summary = await this.processGuild(processedConfig, catalog)
          cycle.matchedCount += summary.matchedCount
          cycle.newCount += summary.newCount
          cycle.queuedCount += summary.queuedCount
          cycle.reopenedCount += summary.reopenedCount
          cycle.pendingCount += summary.pendingCount
          cycle.deliveredCount += summary.deliveredCount
          cycle.failedCount += summary.failedCount
          cycle.legacyAnnouncedCount += summary.legacyAnnouncedCount
        } catch (error) {
          failedGuildCount += 1
          logger.error(
            { err: safe_error_details(error), guildId: config.guildId },
            'Erro ao processar notificações de jogos grátis para guild',
          )
        }
      }

      logger.info(
        {
          guildCount: guildConfigs.length,
          failedGuildCount,
          ...cycle,
        },
        '🎮 Ciclo de jogos grátis concluído',
      )
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao buscar configurações de notificações')
    }
  }

  private async processGuild(config: {
    guildId: string
    channelId: string | null
    roleIds: string[]
    platforms: string[]
    giveawayTypes: string[]
  }, catalog?: GamerPowerGiveaway[]): Promise<guild_free_game_summary> {
    const catalog_count = catalog?.length ?? 0
    const summary = empty_summary(catalog_count)

    if (!config.channelId) {
      logger.warn({ guildId: config.guildId }, 'Guild sem canal configurado para notificações')
      return summary
    }

    const giveaways = catalog
      ? catalog.filter((giveaway) => matchesGuildGiveawayFilters(giveaway, config))
      : await gamerPowerService.getAllGiveaways({
          platforms: config.platforms.length > 0 ? config.platforms : undefined,
          types: config.giveawayTypes.length > 0 ? config.giveawayTypes : undefined,
          sortBy: 'date',
        })

    summary.catalogCount = catalog?.length ?? giveaways.length
    summary.matchedCount = giveaways.length

    if (giveaways.length > 0) {
      const current_giveaway_ids = giveaways.map((giveaway) => String(giveaway.id))
      const current_delivery_keys = current_giveaway_ids.map((giveaway_id) =>
        delivery_key(config.guildId, giveaway_id),
      )

      const [announcedGiveaways, deliveries] = await Promise.all([
        prisma.freeGameGiveaway.findMany({
          where: {
            guildId: config.guildId,
            giveawayId: { in: current_giveaway_ids },
          },
          select: { giveawayId: true },
        }),
        prisma.discordDelivery.findMany({
          where: {
            guildId: config.guildId,
            kind: 'free_game_announcement',
            dedupeKey: { in: current_delivery_keys },
          },
          select: {
            dedupeKey: true,
            deliveredAt: true,
            failedAt: true,
          },
        }),
      ])

      const announcedIds = new Set(announcedGiveaways.map((row) => String(row.giveawayId)))
      const deliveryByKey = new Map(deliveries.map((row) => [row.dedupeKey, row]))
      const reopen_before = Date.now() - FAILED_DELIVERY_REOPEN_COOLDOWN_MS
      const candidates: giveaway_candidate[] = []

      for (const giveaway of giveaways) {
        const giveaway_id = String(giveaway.id)
        const key = delivery_key(config.guildId, giveaway_id)
        const delivery = deliveryByKey.get(key)

        if (delivery?.deliveredAt) {
          summary.deliveredCount += 1
          continue
        }

        if (delivery?.failedAt) {
          summary.failedCount += 1
          if (delivery.failedAt.getTime() <= reopen_before) {
            candidates.push({ giveaway, mode: 'reopen' })
          }
          continue
        }

        if (delivery) {
          summary.pendingCount += 1
          continue
        }

        if (announcedIds.has(giveaway_id)) {
          summary.legacyAnnouncedCount += 1
          continue
        }

        summary.newCount += 1
        candidates.push({ giveaway, mode: 'new' })
      }

      const roleIds = Array.isArray(config.roleIds) ? config.roleIds : []
      const roleMention = roleIds.length > 0
        ? roleIds
            .map((id) =>
              id === config.guildId || id === 'everyone' || id === '@everyone'
                ? '@everyone'
                : `<@&${id}>`,
            )
            .join(' ')
        : null
      const mentionRoleIds = roleIds.filter(
        (id) => id !== config.guildId && id !== 'everyone' && id !== '@everyone',
      )
      const allowEveryone = roleIds.some(
        (id) => id === config.guildId || id === 'everyone' || id === '@everyone',
      )
      const allowedMentions = roleIds.length > 0
        ? {
            ...(mentionRoleIds.length > 0 ? { roles: mentionRoleIds } : {}),
            parse: allowEveryone ? ['everyone' as const] : [],
          }
        : undefined

      for (const candidate of candidates.slice(0, MAX_NOTIFICATIONS_PER_GUILD_PER_CYCLE)) {
        const { giveaway, mode } = candidate
        try {
          const embed = createNotificationEmbed(giveaway)
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('Pegar Agora')
              .setStyle(ButtonStyle.Link)
              .setURL(getGiveawayUrl(giveaway)),
          )
          const input = {
            dedupeKey: delivery_key(config.guildId, giveaway.id),
            kind: 'free_game_announcement',
            guildId: config.guildId,
            channelId: config.channelId,
            payload: {
              message: {
                content: roleMention || undefined,
                embeds: [embed.toJSON()],
                components: [row.toJSON()],
                allowedMentions,
              },
            },
          }

          const result = await prisma.$transaction(async (tx) => {
            if (mode === 'reopen') {
              return await reopen_discord_delivery(tx, input) ? 'reopened' : 'skipped'
            }

            const reserved = await tx.freeGameGiveaway.createMany({
              data: [{ giveawayId: String(giveaway.id), guildId: config.guildId }],
              skipDuplicates: true,
            })
            if (reserved.count === 0) return 'skipped'

            await enqueue_discord_delivery(tx, input)
            return 'queued'
          })

          if (result === 'queued') {
            summary.queuedCount += 1
            logger.info(
              { guildId: config.guildId, giveawayId: giveaway.id, title: giveaway.title },
              'Notificação de jogo grátis enfileirada',
            )
          } else if (result === 'reopened') {
            summary.reopenedCount += 1
            logger.info(
              { guildId: config.guildId, giveawayId: giveaway.id, title: giveaway.title },
              'Notificação de jogo grátis reaberta após falha anterior',
            )
          }
        } catch (error) {
          logger.error(
            { err: safe_error_details(error), guildId: config.guildId, giveawayId: giveaway.id },
            'Erro ao enfileirar notificação de jogo grátis',
          )
        }
      }
    }

    await prisma.freeGameNotification.update({
      where: { guildId: config.guildId },
      data: { lastCheckedAt: new Date() },
    })

    logger.info(
      { guildId: config.guildId, ...summary },
      'Verificação de jogos grátis concluída',
    )

    return summary
  }
}
