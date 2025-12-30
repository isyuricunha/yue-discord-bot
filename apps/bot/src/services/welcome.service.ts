import type { Guild, GuildMember } from 'discord.js'
import { prisma } from '@yuebot/database'
import { pick_discord_message_template_variant, render_discord_message_template } from '@yuebot/shared'

import { logger } from '../utils/logger'

type template_user_input = {
  id: string
  username: string
  tag: string
  avatarUrl: string
  nickname?: string
}

type welcome_config = {
  welcomeChannelId: string | null
  welcomeMessage: string | null
  leaveChannelId: string | null
  leaveMessage: string | null
}

function normalize_config(config: {
  welcomeChannelId: string | null
  welcomeMessage: string | null
  leaveChannelId: string | null
  leaveMessage: string | null
} | null): welcome_config {
  return {
    welcomeChannelId: config?.welcomeChannelId ?? null,
    welcomeMessage: config?.welcomeMessage ?? null,
    leaveChannelId: config?.leaveChannelId ?? null,
    leaveMessage: config?.leaveMessage ?? null,
  }
}

export class WelcomeService {
  private cache: Map<string, { config: welcome_config; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private async get_config(guild_id: string): Promise<welcome_config> {
    const cached = this.cache.get(guild_id)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config
    }

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: guild_id },
      select: {
        welcomeChannelId: true,
        welcomeMessage: true,
        leaveChannelId: true,
        leaveMessage: true,
      },
    })

    const normalized = normalize_config(config)
    this.cache.set(guild_id, { config: normalized, timestamp: now })
    return normalized
  }

  clear_cache(guild_id: string) {
    this.cache.delete(guild_id)
  }

  private async send_template_message(input: {
    guild: Guild
    channelId: string
    template: string
    user: template_user_input
  }): Promise<void> {
    const channel = await input.guild.channels.fetch(input.channelId).catch(() => null)
    if (!channel || !channel.isTextBased()) return

    const chosen = pick_discord_message_template_variant(input.template)
    if (!chosen) return

    const rendered = render_discord_message_template(chosen, {
      user: {
        id: input.user.id,
        username: input.user.username,
        tag: input.user.tag,
        avatarUrl: input.user.avatarUrl,
        nickname: input.user.nickname,
      },
      guild: {
        id: input.guild.id,
        name: input.guild.name,
        memberCount: input.guild.memberCount,
        iconUrl: input.guild.iconURL() ?? undefined,
      },
    })

    await channel.send({
      ...rendered,
      allowedMentions: { parse: [] },
    })
  }

  async handle_member_add(member: GuildMember): Promise<void> {
    const guild_id = member.guild.id
    const config = await this.get_config(guild_id)

    if (!config.welcomeChannelId || !config.welcomeMessage) return

    try {
      await this.send_template_message({
        guild: member.guild,
        channelId: config.welcomeChannelId,
        template: config.welcomeMessage,
        user: {
          id: member.user.id,
          username: member.user.username,
          tag: member.user.tag,
          avatarUrl: member.user.displayAvatarURL(),
          nickname: member.nickname ?? undefined,
        },
      })
    } catch (error) {
      logger.error({ error, guildId: guild_id, userId: member.user.id }, 'Erro ao enviar mensagem de boas-vindas')
    }
  }

  async handle_member_remove(guild: Guild, user: { id: string; username: string; tag: string; avatarUrl: string }): Promise<void> {
    const guild_id = guild.id
    const config = await this.get_config(guild_id)

    if (!config.leaveChannelId || !config.leaveMessage) return

    try {
      await this.send_template_message({
        guild,
        channelId: config.leaveChannelId,
        template: config.leaveMessage,
        user,
      })
    } catch (error) {
      logger.error({ error, guildId: guild_id, userId: user.id }, 'Erro ao enviar mensagem de saída')
    }
  }
}

export const welcomeService = new WelcomeService()
