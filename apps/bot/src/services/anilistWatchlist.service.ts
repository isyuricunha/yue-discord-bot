import { prisma } from '@yuebot/database'

import { aniListService, type anilist_anime, type anilist_manga } from './anilist.service'

export type anilist_media_type = 'anime' | 'manga'

type base_media = {
  id: number
  title: string
  siteUrl: string | null
  imageUrl: string | null
}

function pick_title(input: { title: { english: string | null; romaji: string | null; native: string | null } }): string {
  return input.title.english ?? input.title.romaji ?? input.title.native ?? 'Unknown'
}

function extract_media(input: anilist_anime | anilist_manga): base_media {
  return {
    id: input.id,
    title: pick_title(input),
    siteUrl: input.siteUrl ?? null,
    imageUrl: input.coverImage?.extraLarge ?? input.coverImage?.large ?? null,
  }
}

export type watchlist_list_result = {
  total: number
  items: Array<{
    id: string
    mediaId: number
    mediaType: anilist_media_type
    title: string
    siteUrl: string | null
    imageUrl: string | null
    enabled: boolean
    nextAiringAt: number | null
    nextAiringEpisode: number | null
  }>
  page: number
  pageSize: number
}

export class AniListWatchlistService {
  async ensure_user(userId: string, input: { username?: string | null; avatar?: string | null }): Promise<void> {
    await prisma.user.upsert({
      where: { id: userId },
      update: { username: input.username ?? undefined, avatar: input.avatar ?? undefined },
      create: { id: userId, username: input.username ?? null, avatar: input.avatar ?? null },
    })
  }

  async set_dm_enabled(userId: string, enabled: boolean): Promise<void> {
    await prisma.aniListNotificationSettings.upsert({
      where: { userId },
      update: { dmEnabled: enabled },
      create: { userId, dmEnabled: enabled },
    })
  }

  async get_dm_enabled(userId: string): Promise<boolean> {
    const row = await prisma.aniListNotificationSettings.findUnique({ where: { userId }, select: { dmEnabled: true } })
    return row?.dmEnabled ?? true
  }

  async set_channel_for_guild(input: { userId: string; guildId: string; channelId: string }): Promise<void> {
    await prisma.aniListNotificationChannel.upsert({
      where: { userId_guildId: { userId: input.userId, guildId: input.guildId } },
      update: { channelId: input.channelId, enabled: true },
      create: { userId: input.userId, guildId: input.guildId, channelId: input.channelId, enabled: true },
    })
  }

  async clear_channel_for_guild(input: { userId: string; guildId: string }): Promise<void> {
    await prisma.aniListNotificationChannel.deleteMany({ where: { userId: input.userId, guildId: input.guildId } })
  }

  async get_channel_for_guild(input: { userId: string; guildId: string }): Promise<{ channelId: string } | null> {
    return await prisma.aniListNotificationChannel.findUnique({
      where: { userId_guildId: { userId: input.userId, guildId: input.guildId } },
      select: { channelId: true, enabled: true },
    }).then((row) => (row && row.enabled ? { channelId: row.channelId } : null))
  }

  async list_channels_for_user(userId: string): Promise<Array<{ guildId: string; channelId: string }>> {
    const rows = await prisma.aniListNotificationChannel.findMany({
      where: { userId, enabled: true },
      select: { guildId: true, channelId: true },
    })

    return rows
  }

  async add_by_title(input: { userId: string; mediaType: anilist_media_type; title: string }): Promise<base_media> {
    const trimmed = input.title.trim()
    if (!trimmed) {
      throw new Error('invalid_title')
    }

    const results =
      input.mediaType === 'manga'
        ? await aniListService.search_manga_by_title({ title: trimmed, perPage: 5 })
        : await aniListService.search_anime_by_title({ title: trimmed, perPage: 5 })

    if (results.length === 0) {
      throw new Error('not_found')
    }

    const top = results[0]
    const media = extract_media(top)

    const now = new Date()

    await prisma.aniListWatchlistItem.upsert({
      where: { userId_mediaType_mediaId: { userId: input.userId, mediaType: input.mediaType, mediaId: media.id } },
      update: {
        title: media.title,
        siteUrl: media.siteUrl,
        imageUrl: media.imageUrl,
        enabled: true,
        ...(input.mediaType === 'anime' ? { nextCheckAt: now } : {}),
      },
      create: {
        userId: input.userId,
        mediaId: media.id,
        mediaType: input.mediaType,
        title: media.title,
        siteUrl: media.siteUrl,
        imageUrl: media.imageUrl,
        enabled: true,
        nextCheckAt: now,
      },
    })

    return media
  }

  async remove(input: { userId: string; mediaType: anilist_media_type; mediaId: number }): Promise<boolean> {
    const res = await prisma.aniListWatchlistItem.deleteMany({
      where: { userId: input.userId, mediaType: input.mediaType, mediaId: input.mediaId },
    })

    return res.count > 0
  }

  async list_items(input: { userId: string; page: number; pageSize: number; mediaType?: anilist_media_type | 'all' }): Promise<watchlist_list_result> {
    const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page)) : 1
    const page_size = Math.min(25, Math.max(1, Math.floor(input.pageSize)))

    const where: {
      userId: string
      enabled: boolean
      mediaType?: anilist_media_type
    } = {
      userId: input.userId,
      enabled: true,
    }

    if (input.mediaType && input.mediaType !== 'all') {
      where.mediaType = input.mediaType
    }

    const total = await prisma.aniListWatchlistItem.count({ where })

    const items = await prisma.aniListWatchlistItem.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * page_size,
      take: page_size,
      select: {
        id: true,
        mediaId: true,
        mediaType: true,
        title: true,
        siteUrl: true,
        imageUrl: true,
        enabled: true,
        nextAiringAt: true,
        nextAiringEpisode: true,
      },
    })

    return {
      total,
      items: items.map((i) => ({
        id: i.id,
        mediaId: i.mediaId,
        mediaType: i.mediaType,
        title: i.title,
        siteUrl: i.siteUrl,
        imageUrl: i.imageUrl,
        enabled: i.enabled,
        nextAiringAt: i.nextAiringAt ?? null,
        nextAiringEpisode: i.nextAiringEpisode ?? null,
      })),
      page,
      pageSize: page_size,
    }
  }

  async get_due_anime_items(now: Date): Promise<
    Array<{
      id: string
      userId: string
      mediaId: number
      title: string
      siteUrl: string | null
      imageUrl: string | null
      nextAiringAt: number | null
      nextAiringEpisode: number | null
      lastNotifiedAiringAt: number | null
    }>
  > {
    const rows = await prisma.aniListWatchlistItem.findMany({
      where: {
        mediaType: 'anime',
        enabled: true,
        nextCheckAt: { lte: now },
      },
      orderBy: [{ nextCheckAt: 'asc' }],
      take: 20,
      select: {
        id: true,
        userId: true,
        mediaId: true,
        title: true,
        siteUrl: true,
        imageUrl: true,
        nextAiringAt: true,
        nextAiringEpisode: true,
        lastNotifiedAiringAt: true,
      },
    })

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      mediaId: r.mediaId,
      title: r.title,
      siteUrl: r.siteUrl,
      imageUrl: r.imageUrl,
      nextAiringAt: r.nextAiringAt ?? null,
      nextAiringEpisode: r.nextAiringEpisode ?? null,
      lastNotifiedAiringAt: r.lastNotifiedAiringAt ?? null,
    }))
  }

  async claim_for_tick(input: { id: string; now: Date }): Promise<boolean> {
    const res = await prisma.aniListWatchlistItem.updateMany({
      where: { id: input.id, nextCheckAt: { lte: input.now } },
      data: {
        lastCheckedAt: input.now,
        nextCheckAt: new Date(input.now.getTime() + 60_000),
      },
    })

    return res.count > 0
  }

  async update_airing_cache(input: {
    id: string
    nextAiringAt: number | null
    nextAiringEpisode: number | null
    nextCheckAt: Date
  }): Promise<void> {
    await prisma.aniListWatchlistItem.update({
      where: { id: input.id },
      data: {
        nextAiringAt: input.nextAiringAt ?? null,
        nextAiringEpisode: input.nextAiringEpisode ?? null,
        nextCheckAt: input.nextCheckAt,
      },
    })
  }

  async mark_notified(input: { id: string; airingAt: number; nextCheckAt: Date }): Promise<void> {
    await prisma.aniListWatchlistItem.update({
      where: { id: input.id },
      data: {
        lastNotifiedAiringAt: input.airingAt,
        nextCheckAt: input.nextCheckAt,
      },
    })
  }
}

export const anilistWatchlistService = new AniListWatchlistService()
