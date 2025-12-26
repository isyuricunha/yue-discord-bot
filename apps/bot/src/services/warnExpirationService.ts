import { Client } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'
import { moderationLogService } from './moderationLog.service'

export class WarnExpirationService {
  private intervalId: NodeJS.Timeout | null = null

  constructor(private client: Client) {}

  start() {
    // Executar a cada 1 hora
    this.intervalId = setInterval(() => {
      this.checkExpiredWarns()
    }, 60 * 60 * 1000) // 1 hora

    // Executar imediatamente ao iniciar
    this.checkExpiredWarns()

    logger.info('⏰ Serviço de expiração de warns iniciado')
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info('⏰ Serviço de expiração de warns parado')
    }
  }

  private async checkExpiredWarns() {
    try {
      // Buscar todas as configurações de guilds
      const configs = await prisma.guildConfig.findMany({
        where: {
          warnExpiration: {
            gt: 0, // Somente guilds com expiração configurada
          },
        },
      })

      for (const config of configs) {
        await this.expireWarnsForGuild(config.guildId, config.warnExpiration)
      }
    } catch (error) {
      logger.error({ err: error }, 'Erro ao verificar warns expirados')
    }
  }

  private async expireWarnsForGuild(guildId: string, expirationDays: number) {
    try {
      const guild = await this.client.guilds.fetch(guildId).catch(() => null)
      if (!guild) return

      // Calcular data de corte
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - expirationDays)

      // Buscar warns antigos que devem expirar
      const oldWarns = await prisma.modLog.findMany({
        where: {
          guildId,
          action: 'warn',
          createdAt: {
            lt: cutoffDate,
          },
        },
        include: {
          member: true,
        },
      })

      const pendingWarns = oldWarns.filter((warn) => {
        const metadata = warn.metadata as Record<string, unknown> | null
        return metadata?.warnExpired !== true
      })

      if (pendingWarns.length === 0) {
        return
      }

      // Agrupar por userId
      const warnsByUser = new Map<string, number>()
      pendingWarns.forEach(warn => {
        const count = warnsByUser.get(warn.userId) || 0
        warnsByUser.set(warn.userId, count + 1)
      })

      // Decrementar warnings para cada usuário
      for (const [userId, expiredCount] of warnsByUser.entries()) {
        const user = await this.client.users.fetch(userId).catch(() => null)

        const member = await prisma.guildMember.findUnique({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
        })

        if (!member) continue

        const newWarnings = Math.max(0, member.warnings - expiredCount)

        await prisma.guildMember.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            warnings: newWarnings,
          },
        })

        logger.info(
          `Expirados ${expiredCount} warn(s) de usuário ${userId} em guild ${guildId} (${member.warnings} -> ${newWarnings})`
        )

        // Registrar no modlog
        await prisma.modLog.create({
          data: {
            guildId,
            userId,
            moderatorId: this.client.user!.id,
            action: 'warn_expired',
            reason: `${expiredCount} warn(s) expirado(s) automaticamente após ${expirationDays} dias`,
          },
        })

        if (user) {
          await moderationLogService.notify({
            guild,
            user,
            staff: this.client.user!,
            punishment: 'warn_expired',
            reason: `${expiredCount} warn(s) expirado(s) automaticamente após ${expirationDays} dias`,
            duration: '',
          })
        }
      }

      // Marcar logs de warn como expirados para não processar novamente
      const nowIso = new Date().toISOString()
      await prisma.$transaction(
        pendingWarns.map((warn) => {
          const previous = (warn.metadata as Record<string, unknown> | null) ?? {}
          return prisma.modLog.update({
            where: { id: warn.id },
            data: {
              metadata: {
                ...previous,
                warnExpired: true,
                warnExpiredAt: nowIso,
              },
            },
          })
        })
      )

      logger.info(`Guild ${guildId}: ${warnsByUser.size} usuário(s) com warns expirados`)
    } catch (error) {
      logger.error({ err: error }, `Erro ao expirar warns da guild ${guildId}`)
    }
  }
}
