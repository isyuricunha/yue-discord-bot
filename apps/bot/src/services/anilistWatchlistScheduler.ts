import type { Client } from 'discord.js'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'
import { aniListService } from './anilist.service'
import { anilistWatchlistService } from './anilistWatchlist.service'
import { compute_watchlist_scheduler_outcome } from './anilistWatchlistScheduler.logic'
import { Queue, Worker, Job } from 'bullmq'
import { get_redis_connection } from './queue.connection'

function to_unix_seconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

export class AniListWatchlistScheduler {
  private queue: Queue
  private worker: Worker

  constructor(_client: Client) {
    const redis_connection = get_redis_connection()
    this.queue = new Queue('anilist-queue', { connection: redis_connection as any })
    this.worker = new Worker(
      'anilist-queue',
      async (job: Job) => {
        if (job.name === 'tick') await this.tick()
      },
      { connection: redis_connection as any },
    )
    this.worker.on('failed', (job, err) => {
      logger.error({ err, jobId: job?.id }, '❌ Erro no Worker do AniList Watchlist')
    })
  }

  async start() {
    await this.queue.add('tick', {}, { jobId: 'anilist-tick', repeat: { every: 60_000 } })
    logger.info('📺 AniList watchlist scheduler (BullMQ) started')
  }

  async stop() {
    await this.queue.removeRepeatableByKey('tick')
    await this.worker.close()
    await this.queue.close()
    logger.info('📺 AniList watchlist scheduler (BullMQ) stopped')
  }

  private async tick() {
    try {
      const now = new Date()
      const now_sec = to_unix_seconds(now)
      const due = await anilistWatchlistService.get_due_anime_items(now)
      for (const item of due) {
        const claimed = await anilistWatchlistService.claim_for_tick({ id: item.id, now })
        if (!claimed) continue
        await this.process_one({ now, now_sec, item })
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
          logger.error({ anilistWatchlistItemId: item.id, outcome }, 'Invalid AniList notification outcome')
          await anilistWatchlistService.update_airing_cache({
            id: item.id,
            nextAiringAt: outcome.nextAiringAt,
            nextAiringEpisode: outcome.nextAiringEpisode,
            nextCheckAt: new Date(outcome.nextCheckAtMs),
          })
          return
        }

        await anilistWatchlistService.queue_episode_notifications({
          id: item.id,
          userId: item.userId,
          title: item.title,
          siteUrl: item.siteUrl,
          imageUrl: item.imageUrl,
          airingAt: outcome.notifyAiringAt,
          episode: outcome.notifyEpisode,
          nextAiringAt: outcome.nextAiringAt,
          nextAiringEpisode: outcome.nextAiringEpisode,
          nextCheckAt: new Date(outcome.nextCheckAtMs),
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
}
