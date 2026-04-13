import { EmbedBuilder } from 'discord.js'
import type { Message } from 'discord.js'
import { prisma } from '@yuebot/database'
import { COLORS } from '@yuebot/shared'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

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

export function validate_media_url(raw: string | null | undefined): boolean {
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

async function get_triggers(guild_id: string) {
  return prisma.keywordTrigger.findMany({
    where: { guildId: guild_id },
    orderBy: { createdAt: 'desc' },
  })
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

  return prisma.keywordTrigger.create({
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

  const update_data: any = {}

  if (keywords !== undefined && keywords.length > 0) {
    update_data.keyword = keywords[0]
    update_data.keywords = keywords
  }

  if (media_url !== undefined) update_data.mediaUrl = media_url
  if (content !== undefined) update_data.content = content
  if (channel_id !== undefined) update_data.channelId = channel_id
  if (reply_to_user !== undefined) update_data.replyToUser = reply_to_user

  return prisma.keywordTrigger.update({
    where: { id: existing.id },
    data: update_data
  })
}

async function remove_trigger(guild_id: string, keyword: string) {
  return prisma.keywordTrigger.deleteMany({
    where: {
      guildId: guild_id,
      keyword: keyword.toLowerCase().trim(),
    },
  })
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
}
