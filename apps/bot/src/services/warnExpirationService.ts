import type { Client } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'
import { moderationLogService } from './moderationLog.service'
import { safe_error_details } from '../utils/safe_error'
import { with_serializable_retry } from '../utils/prisma-transaction'

type pending_warn = {
  id: string
  userId: string
  metadata: unknown
}

function was_expired_by_legacy_metadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return (metadata as Record<string, unknown>).warnExpired === true
}

export class WarnExpirationService {
  private intervalId: NodeJS.Timeout | null = null
  private running = false

  constructor(private client: Client) {}

  start() {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      void this.run_once()
    }, 60 * 60 * 1000)

    void this.run_once()
    logger.info('⏰ Serviço de expiração de warns iniciado')
  }

  stop() {
    if (!this.intervalId) return
    clearInterval(this.intervalId)
    this.intervalId = null
    logger.info('⏰ Serviço de expiração de warns parado')
  }

  private async run_once() {
    if (this.running) return
    this.running = true
    try {
      await this.checkExpiredWarns()
    } finally {
      this.running = false
    }
  }

  private async checkExpiredWarns() {
    try {
      const configs = await prisma.guildConfig.findMany({
        where: { warnExpiration: { gt: 0 } },
        select: { guildId: true, warnExpiration: true },
      })

      for (const config of configs) {
        await this.expireWarnsForGuild(config.guildId, config.warnExpiration)
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao verificar warns expirados')
    }
  }

  private async expireWarnsForGuild(guildId: string, expirationDays: number) {
    try {
      const guild = this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null)
      if (!guild) return

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - expirationDays)

      const oldWarns = await prisma.modLog.findMany({
        where: {
guildId,
action: 'warn',
warnExpiredAt: null,
createdAt: { lt: cutoffDate },
        },
        select: { id: true, userId: true, metadata: true },
      }) as pending_warn[]

      const legacy_expired_ids = oldWarns
        .filter((warn) => was_expired_by_legacy_metadata(warn.metadata))
        .map((warn) => warn.id)

      if (legacy_expired_ids.length > 0) {
        await prisma.modLog.updateMany({
where: { id: { in: legacy_expired_ids }, warnExpiredAt: null },
data: { warnExpiredAt: new Date() },
        })
      }

      const pendingWarns = oldWarns.filter((warn) => !was_expired_by_legacy_metadata(warn.metadata))
      if (pendingWarns.length === 0) return

      const warnsByUser = new Map<string, string[]>()
      for (const warn of pendingWarns) {
        const ids = warnsByUser.get(warn.userId) ?? []
        ids.push(warn.id)
        warnsByUser.set(warn.userId, ids)
      }

      for (const [userId, warnIds] of warnsByUser.entries()) {
        const result = await with_serializable_retry(async (tx) => {
const now = new Date()
const claimed = await tx.modLog.updateMany({
  where: { id: { in: warnIds }, warnExpiredAt: null },
  data: { warnExpiredAt: now },
})

if (claimed.count === 0) return null

const member = await tx.guildMember.findUnique({
  where: { userId_guildId: { userId, guildId } },
  select: { warnings: true },
})
if (!member) {
  throw new Error(`guild member missing while expiring warns: ${guildId}/${userId}`)
}

const newWarnings = Math.max(0, member.warnings - claimed.count)
await tx.guildMember.update({
  where: { userId_guildId: { userId, guildId } },
  data: { warnings: newWarnings },
})

await tx.modLog.create({
  data: {
    guildId,
    userId,
    moderatorId: this.client.user!.id,
    action: 'warn_expired',
    reason: `${claimed.count} warn(s) expirado(s) automaticamente após ${expirationDays} dias`,
  },
})

return { expiredCount: claimed.count, before: member.warnings, after: newWarnings }
        })

        if (!result) continue

        logger.info(
`Expirados ${result.expiredCount} warn(s) de usuário ${userId} em guild ${guildId} (${result.before} -> ${result.after})`
        )

        const user = await this.client.users.fetch(userId).catch(() => null)
        if (user) {
await moderationLogService.notify({
  guild,
  user,
  staff: this.client.user!,
  punishment: 'warn_expired',
  reason: `${result.expiredCount} warn(s) expirado(s) automaticamente após ${expirationDays} dias`,
  duration: '',
}).catch((error) => {
  logger.warn({ err: safe_error_details(error), guildId, userId }, 'Falha ao notificar expiração de warn')
})
        }
      }

      logger.info(`Guild ${guildId}: ${warnsByUser.size} usuário(s) com warns expirados`)
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, `Erro ao expirar warns da guild ${guildId}`)
    }
  }
}
