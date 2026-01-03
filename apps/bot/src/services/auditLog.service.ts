import { prisma, Prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

export type audit_action =
  | 'message_delete'
  | 'message_update'
  | 'member_nick_update'
  | 'member_roles_update'
  | 'channel_create'
  | 'channel_update'
  | 'channel_delete'

export class AuditLogService {
  async log(input: {
    guildId: string
    action: audit_action
    actorUserId?: string | null
    targetUserId?: string | null
    targetChannelId?: string | null
    targetMessageId?: string | null
    data?: Prisma.InputJsonValue | null
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          guildId: input.guildId,
          action: input.action,
          actorUserId: input.actorUserId ?? null,
          targetUserId: input.targetUserId ?? null,
          targetChannelId: input.targetChannelId ?? null,
          targetMessageId: input.targetMessageId ?? null,
          data: input.data ?? null,
        },
      })
    } catch (error) {
      logger.error({ err: safe_error_details(error), guildId: input.guildId, action: input.action }, 'Failed to write audit log')
    }
  }
}

export const auditLogService = new AuditLogService()
