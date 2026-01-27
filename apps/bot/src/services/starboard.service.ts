import { EmbedBuilder, PermissionFlagsBits } from 'discord.js'
import type { Guild, GuildTextBasedChannel, Message, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS } from '@yuebot/shared'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

type starboard_config = {
  enabled: boolean
  channelId: string | null
  emoji: string
  threshold: number
  ignoreBots: boolean
}

function normalize_config(row: {
  enabled: boolean
  channelId: string | null
  emoji: string
  threshold: number
  ignoreBots: boolean
} | null): starboard_config {
  return {
    enabled: row?.enabled ?? false,
    channelId: row?.channelId ?? null,
    emoji: row?.emoji ?? '⭐',
    threshold: typeof row?.threshold === 'number' ? Math.max(1, Math.min(50, Math.floor(row.threshold))) : 3,
    ignoreBots: row?.ignoreBots ?? true,
  }
}

function parse_config_emoji(input: string): { id?: string; name?: string } {
  const trimmed = input.trim()
  const match = trimmed.match(/^<a?:[^:]+:(\d+)>$/)
  if (match) return { id: match[1] }
  if (/^\d{5,}$/.test(trimmed)) return { id: trimmed }
  return { name: trimmed }
}

function reaction_matches_config(reaction: MessageReaction, config_emoji: string): boolean {
  const parsed = parse_config_emoji(config_emoji)

  if (parsed.id) {
    return reaction.emoji.id === parsed.id
  }

  if (parsed.name) {
    return reaction.emoji.name === parsed.name
  }

  return false
}

async function ensure_message_fetched(message: Message | any): Promise<Message | null> {
  if (!message) return null
  if (typeof message.partial === 'boolean' && message.partial) {
    return await message.fetch().catch(() => null)
  }
  return message as Message
}

async function get_text_channel(guild: Guild, channel_id: string | null): Promise<GuildTextBasedChannel | null> {
  if (!channel_id) return null
  const channel = await guild.channels.fetch(channel_id).catch(() => null)
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null
  return channel
}

function build_starboard_embed(source: Message, stars: number) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setAuthor({
      name: source.author?.tag ?? source.author?.username ?? 'Unknown',
      iconURL: source.author?.displayAvatarURL?.() ?? undefined,
    })
    .setDescription(source.content?.trim() ? source.content.slice(0, 3900) : '')
    .addFields([{ name: 'Mensagem', value: `[Ir para a mensagem](${source.url})`, inline: true }])
    .setFooter({ text: `${stars} estrelas` })
    .setTimestamp(source.createdAt)

  const first_attachment = source.attachments.first()
  if (first_attachment && first_attachment.contentType?.startsWith('image/')) {
    embed.setImage(first_attachment.url)
  }

  return embed
}

class StarboardService {
  private cache: Map<string, { config: starboard_config; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private async get_config(guild_id: string): Promise<starboard_config> {
    const cached = this.cache.get(guild_id)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config
    }

    const row = await prisma.starboardConfig.findUnique({
      where: { guildId: guild_id },
      select: {
        enabled: true,
        channelId: true,
        emoji: true,
        threshold: true,
        ignoreBots: true,
      },
    })

    const config = normalize_config(row)
    this.cache.set(guild_id, { config, timestamp: now })
    return config
  }

  clear_cache(guild_id: string) {
    this.cache.delete(guild_id)
  }

  async handle_reaction_update(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
    if (user.bot) return

    if (reaction.partial) {
      try {
        await reaction.fetch()
      } catch (error: unknown) {
        logger.warn({ err: safe_error_details(error) }, 'starboard: failed to fetch reaction')
        return
      }
    }

    const message = await ensure_message_fetched(reaction.message)
    if (!message?.guild) return

    const config = await this.get_config(message.guild.id)
    if (!config.enabled || !config.channelId) return

    if (!reaction_matches_config(reaction as MessageReaction, config.emoji)) return

    if (config.ignoreBots && message.author?.bot) return

    const stars = typeof (reaction as MessageReaction).count === 'number' ? (reaction as MessageReaction).count : 0

    if (stars < config.threshold) {
      await this.try_remove_post(message.guild, config, message)
      return
    }

    await this.upsert_post(message.guild, config, message, stars)
  }

  private async try_remove_post(guild: Guild, config: starboard_config, source: Message) {
    const existing = await prisma.starboardPost.findUnique({
      where: {
        guildId_sourceMessageId: {
          guildId: guild.id,
          sourceMessageId: source.id,
        },
      },
      select: {
        id: true,
        starboardChannelId: true,
        starboardMessageId: true,
      },
    })

    if (!existing) return

    const channel = await get_text_channel(guild, existing.starboardChannelId)

    if (channel) {
      try {
        const msg = await channel.messages.fetch(existing.starboardMessageId).catch(() => null)
        if (msg) {
          await msg.delete().catch(() => null)
        }
      } catch (error: unknown) {
        logger.warn({ err: safe_error_details(error) }, 'starboard: failed to delete starboard message')
      }
    }

    await prisma.starboardPost.delete({ where: { id: existing.id } }).catch(() => null)
  }

  private async upsert_post(guild: Guild, config: starboard_config, source: Message, stars: number) {
    const channel = await get_text_channel(guild, config.channelId)
    if (!channel) return

    const me = await guild.members.fetchMe().catch(() => null)
    const perms =
      me && 'permissionsFor' in channel && typeof channel.permissionsFor === 'function'
        ? channel.permissionsFor(me)
        : null

    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return
    }

    const content = `${config.emoji} **${stars}** <#${source.channelId}>`
    const embed = build_starboard_embed(source, stars)

    const existing = await prisma.starboardPost.findUnique({
      where: {
        guildId_sourceMessageId: {
          guildId: guild.id,
          sourceMessageId: source.id,
        },
      },
      select: {
        id: true,
        starboardMessageId: true,
      },
    })

    if (existing) {
      const target = await channel.messages.fetch(existing.starboardMessageId).catch(() => null)
      if (target) {
        await target.edit({ content, embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null)
      }

      await prisma.starboardPost.update({
        where: { id: existing.id },
        data: {
          starCount: stars,
          starboardChannelId: channel.id,
        },
      })

      return
    }

    const sent = await channel.send({ content, embeds: [embed], allowedMentions: { parse: [] } })

    try {
      await prisma.starboardPost.create({
        data: {
          guildId: guild.id,
          sourceChannelId: source.channelId,
          sourceMessageId: source.id,
          starboardChannelId: channel.id,
          starboardMessageId: sent.id,
          authorId: source.author?.id ?? 'unknown',
          starCount: stars,
        },
      })
    } catch (error: unknown) {
      // Best-effort: if a duplicate exists due to race, avoid leaving stray message.
      logger.warn({ err: safe_error_details(error) }, 'starboard: failed to persist post')
      await sent.delete().catch(() => null)
    }
  }
}

export const starboardService = new StarboardService()
