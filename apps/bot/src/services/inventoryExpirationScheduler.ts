import { Client } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

type inventory_row = {
  id: string
  userId: string
  guildId: string | null
  kind: string
  metadata: unknown
  expiresAt: Date | null
}

function extract_role_id(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const any_meta = metadata as Record<string, unknown>
  const role_id = any_meta.roleId
  return typeof role_id === 'string' && role_id.trim() ? role_id : null
}

export class InventoryExpirationScheduler {
  private interval: NodeJS.Timeout | null = null

  constructor(private client: Client) {}

  start() {
    if (this.interval) return

    this.interval = setInterval(() => {
      void this.tick()
    }, 60_000)

    void this.tick()
    logger.info('🎒 Inventory expiration scheduler started')
  }

  stop() {
    if (!this.interval) return
    clearInterval(this.interval)
    this.interval = null
    logger.info('🎒 Inventory expiration scheduler stopped')
  }

  private async tick() {
    try {
      const now = new Date()

      const due = await prisma.inventoryItem.findMany({
        where: {
          activatedAt: { not: null },
          expiresAt: { not: null, lte: now },
          expiredHandledAt: null,
        },
        orderBy: { expiresAt: 'asc' },
        take: 50,
        select: {
          id: true,
          userId: true,
          guildId: true,
          kind: true,
          metadata: true,
          expiresAt: true,
        },
      })

      for (const item of due) {
        await this.handle_one(now, item)
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao processar inventory expiration scheduler')
    }
  }

  private async handle_one(now: Date, item: inventory_row) {
    try {
      if (item.kind === 'xp_boost') {
        await prisma.inventoryItem.updateMany({
          where: { id: item.id, expiredHandledAt: null },
          data: { expiredHandledAt: now },
        })
        return
      }

      if (item.kind === 'temp_role' || item.kind === 'nick_color') {
        const guild_id = item.guildId
        const role_id = extract_role_id(item.metadata)

        if (guild_id && role_id) {
          const guild = await this.client.guilds.fetch(guild_id).catch(() => null)
          if (guild) {
            const member = await guild.members.fetch(item.userId).catch(() => null)
            if (member) {
              await member.roles.remove(role_id).catch(() => null)
            }

            if (item.kind === 'nick_color') {
              const role = await guild.roles.fetch(role_id).catch(() => null)
              if (role && role.members.size === 0 && role.name.startsWith('Yue Color ') && role.editable) {
                await role.delete('inventory nick_color expired').catch(() => null)
              }
            }
          }
        }

        await prisma.inventoryItem.updateMany({
          where: { id: item.id, expiredHandledAt: null },
          data: { expiredHandledAt: now },
        })

        return
      }

      // Default: mark handled
      await prisma.inventoryItem.updateMany({
        where: { id: item.id, expiredHandledAt: null },
        data: { expiredHandledAt: now },
      })
    } catch (error) {
      logger.error({ err: safe_error_details(error), inventoryItemId: item.id }, 'Falha ao processar expiração de item do inventário')
    }
  }
}
