import { EmbedBuilder, type Client, type GuildMember, type VoiceState } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'
import { with_serializable_retry } from '../utils/prisma-transaction'
import { compute_level_from_xp, xpService } from './xp.service'

const MINUTE_MS = 60_000
const FLUSH_INTERVAL_MS = 60_000

export function voice_full_minutes(last_awarded_at: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - last_awarded_at.getTime()) / MINUTE_MS))
}

export function advance_voice_checkpoint(last_awarded_at: Date, minutes: number): Date {
  return new Date(last_awarded_at.getTime() + Math.max(0, Math.trunc(minutes)) * MINUTE_MS)
}

function is_active_voice_state(state: VoiceState | undefined | null): state is VoiceState {
  return Boolean(state?.channelId && !state.mute && !state.deaf)
}

type award_result = {
  new_level: number
  current_level: number
  member_xp: { xp: number; updatedAt: Date }
} | null

class VoiceXpService {
  private client: Client | null = null
  private timer: NodeJS.Timeout | null = null
  private flush_running = false

  async start(client: Client): Promise<void> {
    if (this.client) return
    this.client = client
    await this.reconcile_startup(client)

    this.timer = setInterval(() => {
      void this.flush_active_sessions().catch((error) => {
        logger.error({ error }, 'Voice XP periodic flush failed')
      })
    }, FLUSH_INTERVAL_MS)
    this.timer.unref?.()
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    await this.flush_active_sessions().catch((error) => {
      logger.warn({ error }, 'Voice XP shutdown flush failed')
    })
    this.client = null
  }

  async handle_voice_state_update(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member || oldState.member
    if (!member || member.user.bot) return

    const was_active = is_active_voice_state(oldState)
    const is_now_active = is_active_voice_state(newState)
    if (was_active === is_now_active) return

    if (is_now_active) {
      await this.begin_session(member, newState)
      return
    }

    await this.finish_session(member, oldState)
  }

  private async begin_session(member: GuildMember, state: VoiceState): Promise<void> {
    const config = await xpService.get_config(member.guild.id)
    if (!config?.enabled || !config.voiceXpEnabled) {
      await prisma.voiceXpSession.deleteMany({
        where: { guildId: member.guild.id, userId: member.id },
      })
      return
    }

    const now = new Date()
    await prisma.voiceXpSession.upsert({
      where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
      update: { username: member.user.username },
      create: {
        guildId: member.guild.id,
        userId: member.id,
        username: member.user.username,
        startedAt: now,
        lastAwardedAt: now,
      },
    })

    await this.send_voice_xp_notification(state, config.voiceXpNotificationsEnabled)
  }

  private async finish_session(member: GuildMember, state: VoiceState): Promise<void> {
    const result = await this.consume_checkpoint(member.guild.id, member.id, new Date(), true)
    if (result && result.new_level > result.current_level) {
      await xpService.handle_level_up({ author: member.user, member, guild: member.guild }, result.new_level, {
        xpMember: result.member_xp,
      })
    }
  }

  private async consume_checkpoint(
    guild_id: string,
    user_id: string,
    now: Date,
    remove_after: boolean,
  ): Promise<award_result> {
    const config = await xpService.get_config(guild_id)

    return await with_serializable_retry(async (tx) => {
      const session = await tx.voiceXpSession.findUnique({
        where: { guildId_userId: { guildId: guild_id, userId: user_id } },
      })
      if (!session) return null

      if (!config?.enabled || !config.voiceXpEnabled) {
        await tx.voiceXpSession.delete({ where: { id: session.id } })
        return null
      }

      const minutes = voice_full_minutes(session.lastAwardedAt, now)
      if (minutes <= 0) {
        if (remove_after) await tx.voiceXpSession.delete({ where: { id: session.id } })
        return null
      }

      const configured_per_minute = config.xpPerVoiceMinute ?? 1
      const legacy_per_minute = Math.floor((config.voiceXpRate ?? 10) / 10)
      const xp_per_minute = configured_per_minute > 0 ? configured_per_minute : legacy_per_minute
      const earned_xp = Math.max(0, minutes * xp_per_minute)
      const checkpoint = advance_voice_checkpoint(session.lastAwardedAt, minutes)

      if (earned_xp <= 0) {
        if (remove_after) await tx.voiceXpSession.delete({ where: { id: session.id } })
        else await tx.voiceXpSession.update({ where: { id: session.id }, data: { lastAwardedAt: checkpoint } })
        return null
      }

      const existing = await tx.guildXpMember.findUnique({
        where: { userId_guildId: { userId: user_id, guildId: guild_id } },
      })
      const current_xp = existing?.xp ?? 0
      const current_level = existing?.level ?? compute_level_from_xp(current_xp)
      const new_xp = current_xp + earned_xp
      const new_level = compute_level_from_xp(new_xp)

      const updated = await tx.guildXpMember.upsert({
        where: { userId_guildId: { userId: user_id, guildId: guild_id } },
        create: {
          userId: user_id,
          guildId: guild_id,
          xp: new_xp,
          level: new_level,
          prestige: 0,
          lastVoiceXpAt: now,
        },
        update: {
          xp: new_xp,
          level: new_level,
          lastVoiceXpAt: now,
        },
        select: { xp: true, updatedAt: true },
      })

      if (remove_after) await tx.voiceXpSession.delete({ where: { id: session.id } })
      else await tx.voiceXpSession.update({ where: { id: session.id }, data: { lastAwardedAt: checkpoint } })

      return { current_level, new_level, member_xp: updated }
    }, { max_attempts: 10 })
  }

  private async reconcile_startup(client: Client): Promise<void> {
    const persisted = await prisma.voiceXpSession.findMany()
    const persisted_keys = new Set(persisted.map((session) => `${session.guildId}:${session.userId}`))
    const active: Array<{ state: VoiceState; member: GuildMember }> = []

    for (const guild of client.guilds.cache.values()) {
      for (const state of guild.voiceStates.cache.values()) {
        const member = state.member
        if (!member || member.user.bot || !is_active_voice_state(state)) continue
        active.push({ state, member })
      }
    }

    const active_keys = new Set(active.map(({ member }) => `${member.guild.id}:${member.id}`))
    const stale_ids = persisted
      .filter((session) => !active_keys.has(`${session.guildId}:${session.userId}`))
      .map((session) => session.id)

    if (stale_ids.length > 0) {
      await prisma.voiceXpSession.deleteMany({ where: { id: { in: stale_ids } } })
    }

    const now = new Date()
    for (let offset = 0; offset < active.length; offset += 25) {
      const chunk = active.slice(offset, offset + 25)
      await Promise.all(chunk.map(async ({ member }) => {
        const config = await xpService.get_config(member.guild.id)
        const key = `${member.guild.id}:${member.id}`
        if (!config?.enabled || !config.voiceXpEnabled) {
          if (persisted_keys.has(key)) {
            await prisma.voiceXpSession.deleteMany({ where: { guildId: member.guild.id, userId: member.id } })
          }
          return
        }

        await prisma.voiceXpSession.upsert({
          where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
          update: {
            username: member.user.username,
            // Do not award bot downtime after a restart.
            lastAwardedAt: now,
          },
          create: {
            guildId: member.guild.id,
            userId: member.id,
            username: member.user.username,
            startedAt: now,
            lastAwardedAt: now,
          },
        })
      }))
    }
  }

  async flush_active_sessions(now = new Date()): Promise<void> {
    if (this.flush_running || !this.client) return
    this.flush_running = true

    try {
      const sessions = await prisma.voiceXpSession.findMany()
      for (let offset = 0; offset < sessions.length; offset += 25) {
        const chunk = sessions.slice(offset, offset + 25)
        await Promise.all(chunk.map(async (session) => {
          const guild = this.client?.guilds.cache.get(session.guildId)
          const state = guild?.voiceStates.cache.get(session.userId)
          if (!guild || !is_active_voice_state(state)) {
            await prisma.voiceXpSession.deleteMany({ where: { id: session.id } })
            return
          }

          const result = await this.consume_checkpoint(session.guildId, session.userId, now, false)
          const member = state.member
          if (result && member && result.new_level > result.current_level) {
            await xpService.handle_level_up({ author: member.user, member, guild }, result.new_level, {
              xpMember: result.member_xp,
            })
          }
        }))
      }
    } finally {
      this.flush_running = false
    }
  }

  private async send_voice_xp_notification(state: VoiceState, notifications_enabled: boolean): Promise<void> {
    const member = state.member
    if (!member || !notifications_enabled) return

    try {
      const [user, member_xp] = await Promise.all([
        prisma.user.findUnique({
          where: { id: member.id },
          select: { voiceXpNotificationsEnabled: true },
        }),
        prisma.guildXpMember.findUnique({
          where: { userId_guildId: { userId: member.id, guildId: member.guild.id } },
        }),
      ])
      if (user?.voiceXpNotificationsEnabled === false) return

      const current_xp = member_xp?.xp ?? 0
      const current_level = member_xp?.level ?? compute_level_from_xp(current_xp)
      const xp_progress = current_xp % 1000
      const progress_percent = Math.floor((xp_progress / 1000) * 100)

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎤 XP de Voz Ativado!')
        .setDescription('Você está ganhando XP enquanto fica em call!')
        .addFields(
          { name: 'Nível Atual', value: `**${current_level}**`, inline: true },
          { name: 'XP Total', value: `**${current_xp.toLocaleString('pt-BR')}**`, inline: true },
          { name: 'Próximo Nível', value: `${xp_progress}/1000 XP (${progress_percent}%)`, inline: false },
        )
        .setFooter({ text: 'O XP de voz é confirmado a cada minuto.' })
        .setTimestamp()

      const dm = await member.user.createDM()
      const message = await dm.send({ embeds: [embed] })
      const timer = setTimeout(() => void message.delete().catch(() => undefined), 10_000)
      timer.unref?.()
    } catch {
      // Voice XP must never fail because a notification could not be delivered.
    }
  }
}

export const voiceXpService = new VoiceXpService()
