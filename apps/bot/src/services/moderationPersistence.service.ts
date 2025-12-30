import type { Client, GuildMember } from 'discord.js'
import { prisma } from '@yuebot/database'

import { moderationLogService } from './moderationLog.service'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

function parse_duration_ms(duration: string): number | null {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) return null

  const value = Number.parseInt(match[1]!, 10)
  if (!Number.isFinite(value) || value <= 0) return null

  const unit = match[2]

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }

  const ms = value * (multipliers[unit!] ?? 0)
  if (!ms) return null

  const max = 28 * 24 * 60 * 60 * 1000
  return Math.min(ms, max)
}

async function upsert_member_row(member: GuildMember) {
  await prisma.guildMember.upsert({
    where: {
      userId_guildId: {
        userId: member.user.id,
        guildId: member.guild.id,
      },
    },
    update: {
      username: member.user.username,
      avatar: member.user.avatar,
      joinedAt: member.joinedAt ?? new Date(),
    },
    create: {
      userId: member.user.id,
      guildId: member.guild.id,
      username: member.user.username,
      avatar: member.user.avatar,
      joinedAt: member.joinedAt ?? new Date(),
    },
  })
}

export class ModerationPersistenceService {
  constructor(private client: Client) {}

  async handle_member_add(member: GuildMember): Promise<void> {
    const guild_id = member.guild.id
    const user_id = member.user.id

    try {
      const last = await prisma.modLog.findFirst({
        where: {
          guildId: guild_id,
          userId: user_id,
          action: { in: ['mute', 'mute_reapply', 'unmute'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          duration: true,
          createdAt: true,
        },
      })

      if (!last) return
      if (last.action === 'unmute') return
      if (!last.duration) return

      const duration_ms = parse_duration_ms(last.duration)
      if (!duration_ms) return

      const expires_at = last.createdAt.getTime() + duration_ms
      const now = Date.now()
      if (now >= expires_at) return

      const remaining_ms = expires_at - now

      // Avoid failing when bot can't moderate due to missing permissions/hierarchy.
      if (!member.moderatable) return

      await member.timeout(remaining_ms, '[Auto] Reaplicando timeout (usuário saiu e voltou)')

      await upsert_member_row(member)

      const remaining_minutes = Math.max(1, Math.round(remaining_ms / 60_000))
      const remaining_duration = `${remaining_minutes}m`
      const reason = `Timeout reaplicado automaticamente (${remaining_duration} restantes).`

      await prisma.modLog.create({
        data: {
          guildId: guild_id,
          userId: user_id,
          moderatorId: this.client.user!.id,
          action: 'mute_reapply',
          reason,
          duration: remaining_duration,
          metadata: {
            source: 'auto',
            originalModLogId: last.id,
            originalDuration: last.duration,
            expiresAt: new Date(expires_at).toISOString(),
          },
        },
      })

      await moderationLogService.notify({
        guild: member.guild,
        user: member.user,
        staff: this.client.user!,
        punishment: 'mute_reapply',
        reason,
        duration: remaining_duration,
      })

      logger.info({ guildId: guild_id, userId: user_id, remainingMs: remaining_ms }, 'Timeout reaplicado (member rejoined)')
    } catch (error) {
      logger.error({ err: safe_error_details(error), guildId: guild_id, userId: user_id }, 'Erro ao reaplicar timeout no guildMemberAdd')
    }
  }
}

let moderation_persistence_service: ModerationPersistenceService | null = null

export function initModerationPersistenceService(client: Client) {
  moderation_persistence_service = new ModerationPersistenceService(client)
}

export function getModerationPersistenceService() {
  return moderation_persistence_service
}
