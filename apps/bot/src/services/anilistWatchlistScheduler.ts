import { Client, EmbedBuilder } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'
import { getSendableChannel } from '../utils/discord'
import { aniListService } from './anilist.service'
import { anilistWatchlistService } from './anilistWatchlist.service'
import { compute_watchlist_scheduler_outcome } from './anilistWatchlistScheduler.logic'

function to_unix_seconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

export class AniListWatchlistScheduler {
  private interval: NodeJS.Timeout | null = null

  constructor(private client: Client) {}

  start() {
    if (this.interval) return

    this.interval = setInterval(() => {
      void this.tick()
    }, 60_000)

    void this.tick()

    logger.info('📺 AniList watchlist scheduler started')
  }

  stop() {
    if (!this.interval) return
    clearInterval(this.interval)
    this.interval = null
    logger.info('📺 AniList watchlist scheduler stopped')
  }

  private async tick() {
    try {
      const now = new Date()
      const now_sec = to_unix_seconds(now)

      const due = await anilistWatchlistService.get_due_anime_items(now)
      for (const item of due) {
        const claimed = await anilistWatchlistService.claim_for_tick({ id: item.id, now })
        if (!claimed) continue

        await this.process_one({
          now,
          now_sec,
          item,
        })
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao processar AniList watchlist scheduler')
    }
  }

  private async process_one(input: {
    now: Date
    now_sec: number
    item: {
      id: string
      userId: string
      mediaId: number
      title: string
      siteUrl: string | null
      imageUrl: string | null
      nextAiringAt: number | null
      nextAiringEpisode: number | null
      lastNotifiedAiringAt: number | null
    }
  }) {
    const { now, now_sec, item } = input

    try {
      const next = await aniListService.get_anime_next_airing_episode({ animeId: item.mediaId })

      const outcome = compute_watchlist_scheduler_outcome({
        nowMs: now.getTime(),
        nowSec: now_sec,
        cachedNextAiringAt: item.nextAiringAt,
        cachedNextAiringEpisode: item.nextAiringEpisode,
        next,
        lastNotifiedAiringAt: item.lastNotifiedAiringAt,
      })

      if (outcome.shouldNotify) {
        if (!outcome.notifyAiringAt || !outcome.notifyEpisode) {
          logger.error(
            {
              anilistWatchlistItemId: item.id,
              userId: item.userId,
              mediaId: item.mediaId,
              outcome,
            },
            'Invalid AniList watchlist outcome: shouldNotify=true but notify fields are missing'
          )

          await anilistWatchlistService.update_airing_cache({
            id: item.id,
            nextAiringAt: outcome.nextAiringAt,
            nextAiringEpisode: outcome.nextAiringEpisode,
            nextCheckAt: new Date(outcome.nextCheckAtMs),
          })

          return
        }

        await this.notify_episode({
          userId: item.userId,
          title: item.title,
          siteUrl: item.siteUrl,
          imageUrl: item.imageUrl,
          airingAt: outcome.notifyAiringAt,
          episode: outcome.notifyEpisode,
        })

        const next_check_at = new Date(outcome.nextCheckAtMs)

        await anilistWatchlistService.update_airing_cache({
          id: item.id,
          nextAiringAt: outcome.nextAiringAt,
          nextAiringEpisode: outcome.nextAiringEpisode,
          nextCheckAt: next_check_at,
        })

        await anilistWatchlistService.mark_notified({
          id: item.id,
          airingAt: outcome.notifyAiringAt,
          nextCheckAt: next_check_at,
        })

        return
      }

      await anilistWatchlistService.update_airing_cache({
        id: item.id,
        nextAiringAt: outcome.nextAiringAt,
        nextAiringEpisode: outcome.nextAiringEpisode,
        nextCheckAt: new Date(outcome.nextCheckAtMs),
      })
    } catch (error) {
      logger.error({ err: safe_error_details(error), anilistWatchlistItemId: item.id }, 'Erro ao processar item da watchlist AniList')

      await anilistWatchlistService.update_airing_cache({
        id: item.id,
        nextAiringAt: item.nextAiringAt,
        nextAiringEpisode: item.nextAiringEpisode,
        nextCheckAt: new Date(now.getTime() + 15 * 60 * 1000),
      })
    }
  }

  private async notify_episode(input: {
    userId: string
    title: string
    siteUrl: string | null
    imageUrl: string | null
    airingAt: number
    episode: number
  }) {
    const dm_enabled = await anilistWatchlistService.get_dm_enabled(input.userId)
    const channels = await anilistWatchlistService.list_channels_for_user(input.userId)

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} Novo episódio disponível!`)
      .setDescription(`**${input.title}**${input.siteUrl ? `\n${input.siteUrl}` : ''}`)
      .addFields([
        { name: 'Episódio', value: String(input.episode), inline: true },
        { name: 'Quando', value: `<t:${input.airingAt}:F> (<t:${input.airingAt}:R>)`, inline: true },
      ])

    if (input.imageUrl) embed.setThumbnail(input.imageUrl)

    if (dm_enabled) {
      try {
        const user = await this.client.users.fetch(input.userId)
        await user.send({ embeds: [embed] })
      } catch (error) {
        logger.warn({ err: safe_error_details(error), userId: input.userId }, 'Falha ao enviar DM de lembrete AniList')
      }
    }

    for (const ch of channels) {
      try {
        const channel = await this.client.channels.fetch(ch.channelId).catch(() => null)
        const sendable = getSendableChannel(channel)
        if (!sendable) continue

        await sendable.send({
          content: `<@${input.userId}>`,
          embeds: [embed],
          allowedMentions: { users: [input.userId] },
        })
      } catch (error) {
        logger.warn(
          { err: safe_error_details(error), userId: input.userId, guildId: ch.guildId, channelId: ch.channelId },
          'Falha ao enviar lembrete AniList para canal'
        )
      }
    }
  }
}
