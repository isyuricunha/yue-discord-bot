import type { Client, GuildMember } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'
import { discord_timeout_max_ms, find_triggered_warn_threshold, parseDurationMs, warnThresholdsSchema } from '@yuebot/shared'
import { moderationLogService } from './moderationLog.service'
import { safe_error_details } from '../utils/safe_error'

export class WarnService {
  constructor(private client: Client) {}

  async checkAndApplyThresholds(guildId: string, userId: string, currentWarns: number) {
    try {
      // Buscar configurações de thresholds
      const config = await prisma.guildConfig.findUnique({
        where: { guildId },
      })

      if (!config || !config.warnThresholds) {
        return
      }

      const parsedThresholds = warnThresholdsSchema.safeParse(config.warnThresholds)
      if (!parsedThresholds.success) {
        logger.warn(`warnThresholds inválido para guild ${guildId}`)
        return
      }

      const thresholds = parsedThresholds.data
      
      // Encontrar threshold que foi atingido
      const triggeredThreshold = find_triggered_warn_threshold(thresholds, currentWarns)
      
      if (!triggeredThreshold) {
        return
      }

      logger.info(`Threshold atingido: ${currentWarns} warns -> ${triggeredThreshold.action}`)

      // Buscar guild e member
      const guild = await this.client.guilds.fetch(guildId)
      if (!guild) return

      const member = await guild.members.fetch(userId)
      if (!member) return

      // Aplicar ação
      let applied = false
      switch (triggeredThreshold.action) {
        case 'mute':
          applied = await this.applyMute(member, triggeredThreshold.duration || '1h')
          break
        case 'kick':
          applied = await this.applyKick(member)
          break
        case 'ban':
          applied = await this.applyBan(member)
          break
      }

      if (!applied) {
        return
      }

      // Registrar no modlog
      await prisma.modLog.create({
        data: {
          guildId,
          userId,
          moderatorId: this.client.user!.id,
          action: triggeredThreshold.action,
          reason: `[AutoMod] Threshold de ${currentWarns} warns atingido`,
          duration: triggeredThreshold.duration,
          metadata: {
            source: 'automod',
            rule: 'warn-threshold',
            action: triggeredThreshold.action,
            details: {
              currentWarns,
              threshold: triggeredThreshold.warns,
            },
          },
        },
      })

      await moderationLogService.notify({
        guild,
        user: member.user,
        staff: this.client.user!,
        punishment: triggeredThreshold.action,
        reason: `[AutoMod] Threshold de ${currentWarns} warns atingido`,
        duration: triggeredThreshold.duration,
      })

      logger.info(`Ação ${triggeredThreshold.action} aplicada para ${userId} após ${currentWarns} warns`)
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao verificar thresholds')
    }
  }

  private async applyMute(member: GuildMember, duration: string): Promise<boolean> {
    try {
      const duration_ms = parseDurationMs(duration, { maxMs: discord_timeout_max_ms, clampToMax: true }) ?? 3_600_000
      await member.timeout(duration_ms, '[AutoMod] Threshold de warns atingido')
      logger.info(`Timeout aplicado para ${member.id} por ${duration}`)
      return true
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao aplicar timeout')
      return false
    }
  }

  private async applyKick(member: GuildMember): Promise<boolean> {
    try {
      await member.kick('[AutoMod] Threshold de warns atingido')
      logger.info(`Kick aplicado para ${member.id}`)
      return true
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao aplicar kick')
      return false
    }
  }

  private async applyBan(member: GuildMember): Promise<boolean> {
    try {
      await member.ban({ reason: '[AutoMod] Threshold de warns atingido' })
      logger.info(`Ban aplicado para ${member.id}`)
      return true
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao aplicar ban')
      return false
    }
  }
}
