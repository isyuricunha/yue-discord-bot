import type { Guild, User } from 'discord.js'

import { prisma } from '@yuebot/database'
import { pick_discord_message_template_variant, render_discord_message_template } from '@yuebot/shared'

import { logger } from '../utils/logger'

type modlog_config = {
  modLogChannelId: string | null
  modLogMessage: string | null
}

function normalize_config(config: { modLogChannelId: string | null; modLogMessage: string | null } | null): modlog_config {
  return {
    modLogChannelId: config?.modLogChannelId ?? null,
    modLogMessage: config?.modLogMessage ?? null,
  }
}

class ModerationLogService {
  private cache: Map<string, { config: modlog_config; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private async get_config(guild_id: string): Promise<modlog_config> {
    const cached = this.cache.get(guild_id)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config
    }

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: guild_id },
      select: {
        modLogChannelId: true,
        modLogMessage: true,
      },
    })

    const normalized = normalize_config(config)
    this.cache.set(guild_id, { config: normalized, timestamp: now })
    return normalized
  }

  clear_cache(guild_id: string) {
    this.cache.delete(guild_id)
  }

  async notify(input: {
    guild: Guild
    user: User
    staff: User
    punishment: string
    reason?: string
    duration?: string
  }): Promise<void> {
    const config = await this.get_config(input.guild.id)
    if (!config.modLogChannelId) return

    const channel = await input.guild.channels.fetch(config.modLogChannelId).catch(() => null)
    if (!channel || !channel.isTextBased()) return

    const template =
      config.modLogMessage ??
      JSON.stringify({
        content: '',
        embed: {
          title: '{user.tag} | {punishment}',
          description: '{reason}',
          color: 16742144,
          fields: [
            { name: 'Usuário', value: '`{user.id}`', inline: true },
            { name: 'Staff', value: '{staff.tag}', inline: true },
            { name: 'Duração', value: '{duration}', inline: true },
          ],
        },
      })

    const chosen = pick_discord_message_template_variant(template)
    if (!chosen) return

    const rendered = render_discord_message_template(chosen, {
      user: {
        id: input.user.id,
        username: input.user.username,
        tag: input.user.tag,
        avatarUrl: input.user.displayAvatarURL(),
      },
      staff: {
        id: input.staff.id,
        username: input.staff.username,
        tag: input.staff.tag,
        avatarUrl: input.staff.displayAvatarURL(),
      },
      guild: {
        id: input.guild.id,
        name: input.guild.name,
        memberCount: input.guild.memberCount,
        iconUrl: input.guild.iconURL() ?? undefined,
      },
      punishment: input.punishment,
      reason: input.reason ?? '',
      duration: input.duration ?? '',
    })

    try {
      await channel.send({
        ...rendered,
        allowedMentions: { parse: [] },
      })
    } catch (error) {
      logger.error({ error, guildId: input.guild.id }, 'Erro ao enviar mod log')
    }
  }
}

export const moderationLogService = new ModerationLogService()
