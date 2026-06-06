import { EmbedBuilder } from 'discord.js'
import type { Message } from 'discord.js'
import { prisma, Prisma } from '@yuebot/database'
import { COLORS } from '@yuebot/shared'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'
import { GuildResourceCache } from '../utils/guild_resource_cache'

type keyword_trigger = Prisma.KeywordTriggerGetPayload<Record<string, never>>

const DEFAULT_CACHE_TTL_MS = 10_000

const ALLOWED_DOMAINS = [
  'tenor.com',
  'giphy.com',
  'imgur.com',
  'i.imgur.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'youtube.com',
  'youtu.be',
  'spotify.com',
  'open.spotify.com',
]

const ALLOWED_EXTENSIONS = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4']

function parse_cache_ttl_ms(value: string | undefined): number {
  if (!value) return DEFAULT_CACHE_TTL_MS
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CACHE_TTL_MS
  return parsed
}

export class KeywordTriggerCache extends GuildResourceCache<keyword_trigger[]> {}

function validate_media_url(raw: string | null | undefined): boolean {
  if (!raw) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (url.protocol !== 'https:') return false

  const hostname = url.hostname.toLowerCase()
  const is_allowed_domain = ALLOWED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  )
  if (is_allowed_domain) return true

  // Also accept any https URL whose path ends with a known media extension
  const path_without_query = url.pathname.split('?')[0] ?? ''
  const ext = path_without_query.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXTENSIONS.includes(ext)
}

export function build_remove_trigger_where(guild_id: string, keyword: string): Prisma.KeywordTriggerWhereInput {
  const normalized_keyword = keyword.toLowerCase().trim()
  return {
    guildId: guild_id,
    OR: [
      { keyword: normalized_keyword },
      { keywords: { has: normalized_keyword } },
    ],
  }
}

async function load_triggers(guild_id: string): Promise<keyword_trigger[]> {
  return prisma.keywordTrigger.findMany({
    where: { guildId: guild_id },
    orderBy: { createdAt: 'desc' },
  })
}

const trigger_cache = new KeywordTriggerCache(load_triggers, {
  cache_ttl_ms: parse_cache_ttl_ms(process.env.KEYWORD_TRIGGER_CACHE_TTL_MS),
})

async function get_triggers(guild_id: string) {
  return trigger_cache.get(guild_id)
}

async function add_trigger(
  guild_id: string,
  keywords: string | string[],
  media_url: string | null = null,
  content: string | null = null,
  channel_id: string | null = null,
  created_by: string,
  reply_to_user: boolean = true
) {
  const keyword_list = Array.isArray(keywords) ? keywords : [keywords]
  const primary_keyword = keyword_list[0]

  const trigger = await prisma.keywordTrigger.create({
    data: {
      guildId: guild_id,
      keyword: primary_keyword,
      keywords: keyword_list,
      mediaUrl: media_url || null,
      content: content || null,
      channelId: channel_id ?? null,
      createdBy: created_by,
      replyToUser: reply_to_user,
    },
  })

  trigger_cache.invalidate(guild_id)
  return trigger
}

async function update_trigger(
  guild_id: string,
  existing_keyword: string,
  keywords?: string[],
  media_url?: string | null,
  content?: string | null,
  channel_id?: string | null,
  reply_to_user?: boolean
) {
  const existing = await prisma.keywordTrigger.findFirst({
    where: {
      guildId: guild_id,
      OR: [
        { keyword: existing_keyword.toLowerCase().trim() },
        { keywords: { has: existing_keyword.toLowerCase().trim() } }
      ]
    }
  })

  if (!existing) return null

  const update_data: Prisma.KeywordTriggerUpdateInput = {}

  if (keywords !== undefined && keywords.length > 0) {
    update_data.keyword = keywords[0]
    update_data.keywords = keywords
  }

  if (media_url !== undefined) update_data.mediaUrl = media_url
  if (content !== undefined) update_data.content = content
  if (channel_id !== undefined) update_data.channelId = channel_id
  if (reply_to_user !== undefined) update_data.replyToUser = reply_to_user

  const trigger = await prisma.keywordTrigger.update({
    where: { id: existing.id },
    data: update_data
  })

  trigger_cache.invalidate(guild_id)
  return trigger
}

async function remove_trigger(guild_id: string, keyword: string) {
  const result = await prisma.keywordTrigger.deleteMany({
    where: build_remove_trigger_where(guild_id, keyword),
  })

  if (result.count > 0) {
    trigger_cache.invalidate(guild_id)
  }
  return result
}

async function handle_message(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false

  const content = (message.content ?? '').toLowerCase()
  if (!content.trim()) return false

  let triggers: Awaited<ReturnType<typeof get_triggers>>
  try {
    triggers = await get_triggers(message.guild.id)
  } catch (error) {
    logger.error({ err: safe_error_details(error) }, 'KeywordTrigger: failed to load triggers')
    return false
  }

  const match = triggers.find((t) => {
    if (t.channelId && t.channelId !== message.channelId) return false

    // Check new keywords array first
    if (t.keywords && t.keywords.length > 0) {
      return t.keywords.some(keyword => content.includes(keyword))
    }

    // Fallback to legacy single keyword for backwards compatibility
    if (t.keyword) {
      return content.includes(t.keyword)
    }

    return false
  })

  if (!match) return false

  try {
    const is_image = match.mediaUrl ? validate_media_url(match.mediaUrl) : false
    const embeds: EmbedBuilder[] = []
    let final_content = match.content ?? ''

    if (match.mediaUrl) {
      if (is_image) {
        embeds.push(new EmbedBuilder().setColor(COLORS.INFO).setImage(match.mediaUrl))
      } else {
        // For YouTube, Spotify, etc. — append to content so Discord unfurls them
        final_content = final_content ? `${final_content}\n${match.mediaUrl}` : match.mediaUrl
      }
    }

    const payload = {
      content: final_content || undefined,
      embeds: embeds.length > 0 ? embeds : undefined,
    }

    if (match.replyToUser) {
      await message.reply(payload).catch(() => null)
    } else if (message.channel && 'send' in message.channel) {
      await (message.channel as any).send(payload).catch(() => null)
    }
  } catch (error) {
    logger.error({ err: safe_error_details(error) }, 'KeywordTrigger: failed to send reply')
  }

  // Return false intentionally — we do not want to block XP, AutoMod, etc.
  return false
}

export const keywordTriggerService = {
  get_triggers,
  add_trigger,
  update_trigger,
  remove_trigger,
  handle_message,
  validate_media_url,
  clear_cache: () => trigger_cache.clear(),
  invalidate_guild: (guild_id: string) => trigger_cache.invalidate(guild_id),
}
