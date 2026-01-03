import { prisma, Prisma } from '@yuebot/database'

export type inventory_list_row = {
  id: string
  guildId: string | null
  shopItemId: string | null
  kind: string
  title: string
  description: string | null
  quantity: number
  usedQuantity: number
  metadata: unknown
  activatedAt: Date | null
  expiresAt: Date | null
  expiredHandledAt: Date | null
  createdAt: Date
}

export type inventory_use_result =
  | { success: true; item: inventory_list_row }
  | {
      success: false
      error:
        | 'not_found'
        | 'not_in_guild'
        | 'already_used'
        | 'already_active'
        | 'missing_metadata'
        | 'invalid_metadata'
        | 'discord_action_failed'
    }

type tx_client = Prisma.TransactionClient

async function with_serializable_retry<T>(fn: (tx: tx_client) => Promise<T>, max_attempts = 5): Promise<T> {
  let attempt = 0
  while (true) {
    attempt += 1

    try {
      return await prisma.$transaction(async (tx) => await fn(tx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      const err = error as { code?: unknown }
      const code = typeof err.code === 'string' ? err.code : ''

      // Postgres serialization failure
      if (code === 'P2034' || code === '40001') {
        if (attempt >= max_attempts) throw error
        continue
      }

      throw error
    }
  }
}

function normalize_duration_minutes(input: unknown): number | null {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null
  const value = Math.floor(input)
  if (value <= 0) return null
  return Math.min(value, 30 * 24 * 60)
}

function normalize_multiplier(input: unknown): number | null {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null
  if (input <= 1) return null
  return Math.min(input, 10)
}

export class InventoryService {
  async list(input: { userId: string; guildId: string | null }): Promise<inventory_list_row[]> {
    return await prisma.inventoryItem.findMany({
      where: {
        userId: input.userId,
        OR: [{ guildId: null }, { guildId: input.guildId }],
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        guildId: true,
        shopItemId: true,
        kind: true,
        title: true,
        description: true,
        quantity: true,
        usedQuantity: true,
        metadata: true,
        activatedAt: true,
        expiresAt: true,
        expiredHandledAt: true,
        createdAt: true,
      },
    })
  }

  async find_usable_for_autocomplete(input: { userId: string; guildId: string | null; query?: string }): Promise<
    Array<{ id: string; title: string; kind: string; expiresAt: Date | null }>
  > {
    const q = (input.query ?? '').trim()

    const where =
      q.length > 0
        ? {
            userId: input.userId,
            OR: [{ guildId: null }, { guildId: input.guildId }],
            AND: [
              {
                OR: [
                  { id: { contains: q } },
                  { title: { contains: q, mode: 'insensitive' as const } },
                  { kind: { contains: q, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : {
            userId: input.userId,
            OR: [{ guildId: null }, { guildId: input.guildId }],
          }

    const rows = await prisma.inventoryItem.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
      select: { id: true, title: true, kind: true, expiresAt: true, usedQuantity: true, quantity: true },
    })

    return rows
      .filter((r) => r.usedQuantity < r.quantity)
      .slice(0, 25)
      .map((r) => ({ id: r.id, title: r.title, kind: r.kind, expiresAt: r.expiresAt }))
  }

  async consume_simple(input: { userId: string; guildId: string | null; inventoryItemId: string }): Promise<inventory_use_result> {
    return await with_serializable_retry(async (tx) => {
      const row = await tx.inventoryItem.findUnique({
        where: { id: input.inventoryItemId },
        select: {
          id: true,
          userId: true,
          guildId: true,
          shopItemId: true,
          kind: true,
          title: true,
          description: true,
          quantity: true,
          usedQuantity: true,
          metadata: true,
          activatedAt: true,
          expiresAt: true,
          expiredHandledAt: true,
          createdAt: true,
        },
      })

      if (!row || row.userId !== input.userId) return { success: false as const, error: 'not_found' }
      if (row.guildId && input.guildId && row.guildId !== input.guildId) return { success: false as const, error: 'not_in_guild' }

      if (row.usedQuantity >= row.quantity) return { success: false as const, error: 'already_used' }

      const updated = await tx.inventoryItem.update({
        where: { id: row.id },
        data: { usedQuantity: { increment: 1 } },
        select: {
          id: true,
          guildId: true,
          shopItemId: true,
          kind: true,
          title: true,
          description: true,
          quantity: true,
          usedQuantity: true,
          metadata: true,
          activatedAt: true,
          expiresAt: true,
          expiredHandledAt: true,
          createdAt: true,
        },
      })

      return { success: true as const, item: updated }
    })
  }

  async activate_xp_boost(input: { userId: string; guildId: string | null; inventoryItemId: string; now?: Date }): Promise<inventory_use_result> {
    const now = input.now ?? new Date()

    return await with_serializable_retry(async (tx) => {
      const row = await tx.inventoryItem.findUnique({
        where: { id: input.inventoryItemId },
        select: {
          id: true,
          userId: true,
          guildId: true,
          shopItemId: true,
          kind: true,
          title: true,
          description: true,
          quantity: true,
          usedQuantity: true,
          metadata: true,
          activatedAt: true,
          expiresAt: true,
          expiredHandledAt: true,
          createdAt: true,
        },
      })

      if (!row || row.userId !== input.userId) return { success: false as const, error: 'not_found' }
      if (row.guildId && input.guildId && row.guildId !== input.guildId) return { success: false as const, error: 'not_in_guild' }
      if (row.usedQuantity >= row.quantity) return { success: false as const, error: 'already_used' }
      if (row.activatedAt) return { success: false as const, error: 'already_active' }

      const meta = row.metadata as Record<string, unknown> | null
      if (!meta) return { success: false as const, error: 'missing_metadata' }

      const duration_minutes = normalize_duration_minutes(meta.durationMinutes)
      const multiplier = normalize_multiplier(meta.multiplier)
      if (!duration_minutes || !multiplier) return { success: false as const, error: 'invalid_metadata' }

      const expires_at = new Date(now.getTime() + duration_minutes * 60 * 1000)

      const updated = await tx.inventoryItem.update({
        where: { id: row.id },
        data: {
          usedQuantity: { increment: 1 },
          activatedAt: now,
          expiresAt: expires_at,
        },
        select: {
          id: true,
          guildId: true,
          shopItemId: true,
          kind: true,
          title: true,
          description: true,
          quantity: true,
          usedQuantity: true,
          metadata: true,
          activatedAt: true,
          expiresAt: true,
          expiredHandledAt: true,
          createdAt: true,
        },
      })

      return { success: true as const, item: updated }
    })
  }

  async activate_role(input: {
    userId: string
    guildId: string
    inventoryItemId: string
    now?: Date
    add_role: (role_id: string) => Promise<boolean>
  }): Promise<inventory_use_result> {
    const now = input.now ?? new Date()

    return await with_serializable_retry(async (tx) => {
      const row = await tx.inventoryItem.findUnique({
        where: { id: input.inventoryItemId },
        select: {
          id: true,
          userId: true,
          guildId: true,
          shopItemId: true,
          kind: true,
          title: true,
          description: true,
          quantity: true,
          usedQuantity: true,
          metadata: true,
          activatedAt: true,
          expiresAt: true,
          expiredHandledAt: true,
          createdAt: true,
        },
      })

      if (!row || row.userId !== input.userId) return { success: false as const, error: 'not_found' }
      if (row.guildId && row.guildId !== input.guildId) return { success: false as const, error: 'not_in_guild' }
      if (row.usedQuantity >= row.quantity) return { success: false as const, error: 'already_used' }
      if (row.activatedAt) return { success: false as const, error: 'already_active' }

      const meta = row.metadata as Record<string, unknown> | null
      if (!meta) return { success: false as const, error: 'missing_metadata' }

      const role_id = typeof meta.roleId === 'string' ? meta.roleId : null
      const duration_minutes = normalize_duration_minutes(meta.durationMinutes)
      if (!role_id || !duration_minutes) return { success: false as const, error: 'invalid_metadata' }

      const ok = await input.add_role(role_id)
      if (!ok) return { success: false as const, error: 'discord_action_failed' }

      const expires_at = new Date(now.getTime() + duration_minutes * 60 * 1000)

      const updated = await tx.inventoryItem.update({
        where: { id: row.id },
        data: {
          usedQuantity: { increment: 1 },
          activatedAt: now,
          expiresAt: expires_at,
        },
        select: {
          id: true,
          guildId: true,
          shopItemId: true,
          kind: true,
          title: true,
          description: true,
          quantity: true,
          usedQuantity: true,
          metadata: true,
          activatedAt: true,
          expiresAt: true,
          expiredHandledAt: true,
          createdAt: true,
        },
      })

      return { success: true as const, item: updated }
    })
  }

  async consume_reroll_ticket_if_available(input: { tx: tx_client; userId: string; guildId: string; now: Date }): Promise<boolean> {
    const rows = await input.tx.inventoryItem.findMany({
      where: {
        userId: input.userId,
        kind: 'waifu_reroll_ticket',
        OR: [{ guildId: null }, { guildId: input.guildId }],
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
      select: { id: true, usedQuantity: true, quantity: true },
    })

    const candidate = rows.find((r) => r.usedQuantity < r.quantity)
    if (!candidate) return false

    const updated = await input.tx.inventoryItem.updateMany({
      where: {
        id: candidate.id,
        usedQuantity: { lt: candidate.quantity },
      },
      data: {
        usedQuantity: { increment: 1 },
      },
    })

    return updated.count > 0
  }

  async get_active_xp_boost_multiplier(input: { userId: string; guildId: string; now: Date }): Promise<number> {
    const rows = await prisma.inventoryItem.findMany({
      where: {
        userId: input.userId,
        kind: 'xp_boost',
        OR: [{ guildId: null }, { guildId: input.guildId }],
        activatedAt: { not: null },
        expiresAt: { gt: input.now },
      },
      orderBy: { expiresAt: 'asc' },
      take: 10,
      select: { metadata: true },
    })

    let best = 1
    for (const r of rows) {
      const meta = r.metadata as Record<string, unknown> | null
      if (!meta) continue
      const value = normalize_multiplier(meta.multiplier)
      if (!value) continue
      best = Math.max(best, value)
    }

    return best
  }
}

export const inventoryService = new InventoryService()
