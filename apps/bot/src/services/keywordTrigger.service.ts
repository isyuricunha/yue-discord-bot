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
]

const ALLOWED_EXTENSIONS = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4']

export function validate_media_url(raw: string): boolean {
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
  keyword: string,
  media_url: string,
  channel_id: string | null,
  created_by: string,
  reply_to_user: boolean = true
) {
  return prisma.keywordTrigger.create({
    data: {
      guildId: guild_id,
      keyword: keyword.toLowerCase().trim(),
      mediaUrl: media_url,
      channelId: channel_id ?? null,
      createdBy: created_by,
      replyToUser: reply_to_user,
    },
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
    if (!content.includes(t.keyword)) return false
    if (t.channelId && t.channelId !== message.channelId) return false
    return true
  })

  if (!match) return false

  try {
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setImage(match.mediaUrl)

    const payload = { embeds: [embed] }
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
  remove_trigger,
  handle_message,
  validate_media_url,
}
