import type { Client, GuildMember, TextChannel } from 'discord.js'
import { PermissionFlagsBits } from 'discord.js'
import { prisma } from '@yuebot/database'
import type { GuildAntiRaidConfig } from '@yuebot/database'
import { discord_timeout_max_ms } from '@yuebot/shared'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

interface JoinRecord {
  timestamp: number
  memberId: string
}

interface AntiRaidConfigInput {
  enabled?: boolean
  joinThreshold?: number
  joinTimeWindow?: number
  action?: string
  duration?: number
  exemptRoles?: string[]
  cooldown?: number
  notificationChannelId?: string | null
}

const CACHE_CLEANUP_INTERVAL_MS = 60_000
const RAID_RECOVERY_INTERVAL_MS = 30_000
const DEFAULT_JOIN_WINDOW_SECONDS = 60
const MAX_JOIN_WINDOW_SECONDS = 300
const DEFAULT_JOIN_THRESHOLD = 10
const DEFAULT_COOLDOWN_SECONDS = 300

export function filter_recent_anti_raid_joins(records: JoinRecord[], now: number, window_seconds: number): JoinRecord[] {
  const safe_window = Math.max(1, Math.min(MAX_JOIN_WINDOW_SECONDS, Math.floor(window_seconds))) * 1000
  return records.filter((record) => now - record.timestamp < safe_window)
}

export function is_anti_raid_cooldown_active(last_raid_at: Date | null, cooldown_seconds: number, now: number): boolean {
  if (!last_raid_at) return false
  const safe_cooldown = Math.max(1, Math.floor(cooldown_seconds)) * 1000
  return now - last_raid_at.getTime() < safe_cooldown
}

class AntiRaidService {
  private joinCache: Map<string, JoinRecord[]> = new Map()
  private client: Client | null = null
  private recoveryTimer: NodeJS.Timeout | null = null

  constructor() {
    const cleanup = setInterval(() => this.cleanupCache(), CACHE_CLEANUP_INTERVAL_MS)
    cleanup.unref?.()
  }

  setClient(client: Client): void {
    this.client = client
    if (!this.recoveryTimer) {
      this.recoveryTimer = setInterval(() => void this.recoverActiveRaids(), RAID_RECOVERY_INTERVAL_MS)
      this.recoveryTimer.unref?.()
    }
    void this.recoverActiveRaids()
  }

  private cleanupCache(): void {
    const now = Date.now()
    const max_window_ms = MAX_JOIN_WINDOW_SECONDS * 1000

    for (const [guildId, records] of this.joinCache.entries()) {
      const filtered = records.filter((record) => now - record.timestamp < max_window_ms)
      if (filtered.length === 0) this.joinCache.delete(guildId)
      else this.joinCache.set(guildId, filtered)
    }
  }

  async getConfig(guildId: string): Promise<GuildAntiRaidConfig | null> {
    return prisma.guildAntiRaidConfig.findUnique({ where: { guildId } })
  }

  async getOrCreateConfig(guildId: string): Promise<GuildAntiRaidConfig> {
    return prisma.guildAntiRaidConfig.upsert({
      where: { guildId },
      update: {},
      create: {
        guildId,
        enabled: false,
        joinThreshold: DEFAULT_JOIN_THRESHOLD,
        joinTimeWindow: DEFAULT_JOIN_WINDOW_SECONDS,
        action: 'mute',
        duration: 10,
        exemptRoles: [],
        exemptChannels: [],
        cooldown: DEFAULT_COOLDOWN_SECONDS,
        raidActive: false,
        locked: false,
      },
    })
  }

  async updateConfig(guildId: string, data: AntiRaidConfigInput): Promise<GuildAntiRaidConfig> {
    await this.getOrCreateConfig(guildId)
    return prisma.guildAntiRaidConfig.update({
      where: { guildId },
      data: { ...data, updatedAt: new Date() },
    })
  }

  isMemberExempt(member: GuildMember, config: GuildAntiRaidConfig): boolean {
    const exemptRoles = (config.exemptRoles as string[]) || []
    return member.roles.cache.some((role) => exemptRoles.includes(role.id))
  }

  private async applyRaidAction(member: GuildMember, config: GuildAntiRaidConfig): Promise<boolean> {
    if (this.isMemberExempt(member, config)) return false

    const action = config.action || 'mute'
    const duration = config.duration || 10
    const durationMs = Math.min(duration * 60 * 1000, discord_timeout_max_ms)

    try {
      if (action === 'kick') await member.kick('[AntiRaid] Detecção de raide')
      else if (action === 'ban') await member.ban({ reason: '[AntiRaid] Detecção de raide' })
      else await member.timeout(durationMs, '[AntiRaid] Detecção de raide')
      return true
    } catch (error) {
      logger.error(
        { err: safe_error_details(error), guildId: member.guild.id, memberId: member.id, action },
        'AntiRaid: failed to apply action',
      )
      return false
    }
  }

  async trackJoin(guildId: string, member: GuildMember): Promise<boolean> {
    const config = await this.getConfig(guildId)
    if (!config || !config.enabled) return false
    if (this.isMemberExempt(member, config)) return false

    const now = Date.now()

    if (config.raidActive) {
      if (config.raidEndsAt && config.raidEndsAt.getTime() <= now) {
        await this.endRaid(guildId, member.client)
      } else {
        await this.applyRaidAction(member, config)
        return true
      }
    }

    const cooldown = config.cooldown || DEFAULT_COOLDOWN_SECONDS
    if (is_anti_raid_cooldown_active(config.lastRaidAt, cooldown, now)) return false

    const records = this.joinCache.get(guildId) || []
    records.push({ timestamp: now, memberId: member.id })
    const filtered = filter_recent_anti_raid_joins(
      records,
      now,
      config.joinTimeWindow || DEFAULT_JOIN_WINDOW_SECONDS,
    )
    this.joinCache.set(guildId, filtered)

    const threshold = config.joinThreshold || DEFAULT_JOIN_THRESHOLD
    if (filtered.length < threshold) return false

    logger.info({ guildId, joinCount: filtered.length, threshold }, 'AntiRaid: raid threshold exceeded')
    return await this.triggerRaid(guildId, member.client)
  }

  async checkRaid(guildId: string): Promise<boolean> {
    const config = await this.getConfig(guildId)
    if (!config || !config.enabled || config.raidActive) return false

    const records = filter_recent_anti_raid_joins(
      this.joinCache.get(guildId) || [],
      Date.now(),
      config.joinTimeWindow || DEFAULT_JOIN_WINDOW_SECONDS,
    )
    this.joinCache.set(guildId, records)
    return records.length >= (config.joinThreshold || DEFAULT_JOIN_THRESHOLD)
  }

  async triggerRaid(guildId: string, client: Client): Promise<boolean> {
    const config = await this.getConfig(guildId)
    if (!config || !config.enabled) return false

    const now = new Date()
    const cooldown_seconds = config.cooldown || DEFAULT_COOLDOWN_SECONDS
    const cooldown_ms = cooldown_seconds * 1000
    const cooldown_cutoff = new Date(now.getTime() - cooldown_ms)
    const raid_ends_at = new Date(now.getTime() + cooldown_ms)

    const claimed = await prisma.guildAntiRaidConfig.updateMany({
      where: {
        guildId,
        enabled: true,
        raidActive: false,
        OR: [{ lastRaidAt: null }, { lastRaidAt: { lte: cooldown_cutoff } }],
      },
      data: { raidActive: true, lastRaidAt: now, raidEndsAt: raid_ends_at },
    })
    if (claimed.count === 0) return false

    const end_timer = setTimeout(() => void this.endRaid(guildId, client), cooldown_ms)
    end_timer.unref?.()

    const discordGuild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null)
    if (!discordGuild) {
      logger.warn({ guildId }, 'AntiRaid: guild not found; persisted recovery will end the raid')
      return true
    }

    try {
      const records = filter_recent_anti_raid_joins(
        this.joinCache.get(guildId) || [],
        now.getTime(),
        config.joinTimeWindow || DEFAULT_JOIN_WINDOW_SECONDS,
      )
      const member_ids = Array.from(new Set(records.map((record) => record.memberId)))
      let actionCount = 0

      for (const member_id of member_ids) {
        const member = discordGuild.members.cache.get(member_id) ?? await discordGuild.members.fetch(member_id).catch(() => null)
        if (!member) continue
        if (await this.applyRaidAction(member, config)) actionCount += 1
      }

      if (config.notificationChannelId) {
        const channel = await discordGuild.channels.fetch(config.notificationChannelId).catch(() => null) as TextChannel | null
        if (channel?.isTextBased()) {
          const actionText: Record<string, string> = { mute: 'silenciados', kick: 'expulsos', ban: 'banidos' }
          await channel.send({
            content: `⚠️ **RAIDE DETECTADO!**\n${actionCount} membros foram ${actionText[config.action] || 'acionados'} devido a uma onda de entradas suspeitas.\nProteção contra raide ativada!`,
          }).catch((error) => {
            logger.error({ err: safe_error_details(error), guildId }, 'AntiRaid: failed to send notification')
          })
        }
      }

      logger.info({ guildId, action: config.action, actionCount, raidEndsAt: raid_ends_at }, 'AntiRaid: raid protection triggered')
    } catch (error) {
      logger.error({ err: safe_error_details(error), guildId }, 'AntiRaid: error during raid detection')
    }

    return true
  }

  async endRaid(guildId: string, client: Client): Promise<void> {
    const now = new Date()
    const config = await this.getConfig(guildId)
    if (!config?.raidActive) return
    if (config.raidEndsAt && config.raidEndsAt.getTime() > now.getTime()) return

    const ended = await prisma.guildAntiRaidConfig.updateMany({
      where: { guildId, raidActive: true, OR: [{ raidEndsAt: null }, { raidEndsAt: { lte: now } }] },
      data: { raidActive: false, raidEndsAt: null },
    })
    if (ended.count === 0) return

    this.joinCache.delete(guildId)

    const discordGuild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null)
    if (discordGuild && config.notificationChannelId) {
      const channel = await discordGuild.channels.fetch(config.notificationChannelId).catch(() => null) as TextChannel | null
      if (channel?.isTextBased()) {
        await channel.send({ content: '✅ **Proteção contra raide encerrada!**\nO servidor voltou ao normal.' }).catch((error) => {
          logger.error({ err: safe_error_details(error), guildId }, 'AntiRaid: failed to send end notification')
        })
      }
    }

    logger.info({ guildId }, 'AntiRaid: raid ended')
  }

  private async recoverActiveRaids(): Promise<void> {
    if (!this.client) return
    const now = new Date()
    const due = await prisma.guildAntiRaidConfig.findMany({
      where: { raidActive: true, OR: [{ raidEndsAt: null }, { raidEndsAt: { lte: now } }] },
      select: { guildId: true },
      take: 100,
    }).catch((error) => {
      logger.error({ err: safe_error_details(error) }, 'AntiRaid: failed to load raids for recovery')
      return []
    })

    for (const row of due) await this.endRaid(row.guildId, this.client)
  }

  async lockServer(guildId: string, client: Client): Promise<boolean> {
    const config = await this.getConfig(guildId)
    if (!config) return false
    if (config.locked) return true

    const discordGuild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null)
    if (!discordGuild) return false

    const original_permissions = discordGuild.roles.everyone.permissions.bitfield.toString()
    const claimed = await prisma.guildAntiRaidConfig.updateMany({
      where: { guildId, locked: false },
      data: { locked: true, lockedEveryonePermissions: original_permissions },
    })
    if (claimed.count === 0) return true

    try {
      await discordGuild.roles.everyone.setPermissions(
        discordGuild.roles.everyone.permissions.remove(PermissionFlagsBits.SendMessages),
      )
      logger.info({ guildId }, 'AntiRaid: server locked')
      return true
    } catch (error) {
      await prisma.guildAntiRaidConfig.updateMany({
        where: { guildId, locked: true, lockedEveryonePermissions: original_permissions },
        data: { locked: false, lockedEveryonePermissions: null },
      })
      logger.error({ err: safe_error_details(error), guildId }, 'AntiRaid: failed to lock server')
      return false
    }
  }

  async unlockServer(guildId: string, client: Client): Promise<boolean> {
    const config = await this.getConfig(guildId)
    if (!config) return false
    if (!config.locked) return true

    const discordGuild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null)
    if (!discordGuild) return false

    if (!config.lockedEveryonePermissions) {
      logger.warn({ guildId }, 'AntiRaid: legacy lock has no permission snapshot; refusing to grant SendMessages implicitly')
      await prisma.guildAntiRaidConfig.update({ where: { guildId }, data: { locked: false } })
      return true
    }

    try {
      await discordGuild.roles.everyone.setPermissions(BigInt(config.lockedEveryonePermissions))
      await prisma.guildAntiRaidConfig.update({
        where: { guildId },
        data: { locked: false, lockedEveryonePermissions: null },
      })
      logger.info({ guildId }, 'AntiRaid: server unlocked with exact permission snapshot')
      return true
    } catch (error) {
      logger.error({ err: safe_error_details(error), guildId }, 'AntiRaid: failed to unlock server')
      return false
    }
  }

  getJoinCount(guildId: string): number {
    return (this.joinCache.get(guildId) || []).length
  }

  clearCache(guildId: string): void {
    this.joinCache.delete(guildId)
  }
}

export const antiRaidService = new AntiRaidService()
