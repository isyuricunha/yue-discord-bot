import { Client } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

const CLAIM_LEASE_MS = 5 * 60 * 1000

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
  const role_id = (metadata as Record<string, unknown>).roleId
  return typeof role_id === 'string' && role_id.trim() ? role_id : null
}

function is_unknown_member_error(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 10007
}

export class InventoryExpirationScheduler {
  private interval: NodeJS.Timeout | null = null
  private running = false

  constructor(private client: Client) {}

  start() {
    if (this.interval) return
    this.interval = setInterval(() => void this.tick(), 60_000)
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
    if (this.running) return
    this.running = true
    try {
      const now = new Date()
      const stale_claim = new Date(now.getTime() - CLAIM_LEASE_MS)
      const due = await prisma.inventoryItem.findMany({
        where: {
activatedAt: { not: null },
expiresAt: { not: null, lte: now },
expiredHandledAt: null,
OR: [{ expirationClaimedAt: null }, { expirationClaimedAt: { lt: stale_claim } }],
        },
        orderBy: { expiresAt: 'asc' },
        take: 50,
        select: { id: true, userId: true, guildId: true, kind: true, metadata: true, expiresAt: true },
      })

      for (const item of due) {
        const claimed = await prisma.inventoryItem.updateMany({
where: {
  id: item.id,
  expiredHandledAt: null,
  OR: [{ expirationClaimedAt: null }, { expirationClaimedAt: { lt: stale_claim } }],
},
data: { expirationClaimedAt: now },
        })
        if (claimed.count === 0) continue
        await this.handle_one(now, item)
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao processar inventory expiration scheduler')
    } finally {
      this.running = false
    }
  }

  private async handle_one(now: Date, item: inventory_row) {
    try {
      if (item.kind === 'temp_role' || item.kind === 'nick_color') {
        const guild_id = item.guildId
        const role_id = extract_role_id(item.metadata)

        if (guild_id && role_id) {
const guild = this.client.guilds.cache.get(guild_id) ?? await this.client.guilds.fetch(guild_id)
let member = guild.members.cache.get(item.userId) ?? null
if (!member) {
  try {
    member = await guild.members.fetch(item.userId)
  } catch (error) {
    if (!is_unknown_member_error(error)) throw error
  }
}

if (member?.roles.cache.has(role_id)) {
  await member.roles.remove(role_id)
}

if (item.kind === 'nick_color') {
  const role = guild.roles.cache.get(role_id) ?? await guild.roles.fetch(role_id)
  if (role && role.members.size === 0 && role.name.startsWith('Yue Color ') && role.editable) {
    await role.delete('inventory nick_color expired')
  }
}
        }
      }

      await prisma.inventoryItem.updateMany({
        where: { id: item.id, expiredHandledAt: null },
        data: { expiredHandledAt: now, expirationClaimedAt: null },
      })
    } catch (error) {
      await prisma.inventoryItem.updateMany({
        where: { id: item.id },
        data: { expirationClaimedAt: null },
      }).catch(() => undefined)
      logger.error({ err: safe_error_details(error), inventoryItemId: item.id }, 'Falha ao processar expiração de item do inventário; será tentado novamente')
    }
  }
}
