import type { Guild, User } from 'discord.js'

import { prisma } from '@yuebot/database'
import { pick_discord_message_template_variant, render_discord_message_template } from '@yuebot/shared'

import { logger } from '../utils/logger'

type report_config = {
  reportChannelId: string | null
  reportMessage: string | null
}

function normalize_config(config: { reportChannelId: string | null; reportMessage: string | null } | null): report_config {
  return {
    reportChannelId: config?.reportChannelId ?? null,
    reportMessage: config?.reportMessage ?? null,
  }
}

class ReportLogService {
  private cache: Map<string, { config: report_config; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private async get_config(guild_id: string): Promise<report_config> {
    const cached = this.cache.get(guild_id)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config
    }

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: guild_id },
      select: {
        reportChannelId: true,
        reportMessage: true,
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
    reportedUser: User
    reporter: User
    reason: string
  }): Promise<void> {
    const config = await this.get_config(input.guild.id)
    if (!config.reportChannelId) return

    const channel = await input.guild.channels.fetch(config.reportChannelId).catch(() => null)
    if (!channel || !channel.isTextBased()) return

    const template =
      config.reportMessage ??
      JSON.stringify({
        content: '',
        embed: {
          title: '🚩 Denúncia',
          description: '{reason}',
          color: 15105570,
          fields: [
            { name: 'Denunciado', value: '{@user} (`{user.id}`)', inline: true },
            { name: 'Denunciante', value: '{@staff} (`{staff.id}`)', inline: true },
            { name: 'Servidor', value: '{guild} (`{guild.id}`)', inline: false },
          ],
        },
      })

    const chosen = pick_discord_message_template_variant(template)
    if (!chosen) return

    const rendered = render_discord_message_template(chosen, {
      user: {
        id: input.reportedUser.id,
        username: input.reportedUser.username,
        tag: input.reportedUser.tag,
        avatarUrl: input.reportedUser.displayAvatarURL(),
      },
      staff: {
        id: input.reporter.id,
        username: input.reporter.username,
        tag: input.reporter.tag,
        avatarUrl: input.reporter.displayAvatarURL(),
      },
      guild: {
        id: input.guild.id,
        name: input.guild.name,
        memberCount: input.guild.memberCount,
        iconUrl: input.guild.iconURL() ?? undefined,
      },
      reason: input.reason,
      punishment: 'report',
    })

    try {
      await channel.send({
        ...rendered,
        allowedMentions: { parse: [] },
      })
    } catch (error) {
      logger.error({ error, guildId: input.guild.id }, 'Erro ao enviar report log')
    }
  }
}

export const reportLogService = new ReportLogService()
