import { prisma, Prisma } from '@yuebot/database'

export type shop_purchase_result =
  | {
      success: true
      purchaseId: string
      inventoryItemIds: string[]
      balance: bigint
      total: bigint
    }
  | {
      success: false
      error:
        | 'invalid_quantity'
        | 'item_not_found'
        | 'item_disabled'
        | 'insufficient_funds'
        | 'invalid_price'
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

function normalize_quantity(input: number): number {
  if (!Number.isFinite(input)) return 0
  return Math.max(0, Math.floor(input))
}

function clamp_quantity(input: number): number {
  return Math.min(Math.max(input, 0), 50)
}

export class ShopService {
  async list_items(input: { guildId: string | null; include_disabled?: boolean }): Promise<
    Array<{
      id: string
      guildId: string | null
      name: string
      description: string | null
      kind: string
      price: bigint
      enabled: boolean
      stackable: boolean
      metadata: unknown
    }>
  > {
    const include_disabled = Boolean(input.include_disabled)

    return await prisma.shopItem.findMany({
      where: {
        enabled: include_disabled ? undefined : true,
        OR: [{ guildId: null }, { guildId: input.guildId }],
      },
      orderBy: [{ guildId: 'asc' }, { price: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        guildId: true,
        name: true,
        description: true,
        kind: true,
        price: true,
        enabled: true,
        stackable: true,
        metadata: true,
      },
    })
  }

  async purchase(input: {
    userId: string
    guildId: string | null
    shopItemId: string
    quantity: number
    reason?: string | null
  }): Promise<shop_purchase_result> {
    const quantity = clamp_quantity(normalize_quantity(input.quantity))
    if (quantity <= 0) return { success: false as const, error: 'invalid_quantity' }

    return await with_serializable_retry(async (tx) => {
      await tx.user.upsert({ where: { id: input.userId }, update: {}, create: { id: input.userId } })

      const item = await tx.shopItem.findFirst({
        where: {
          id: input.shopItemId,
          enabled: true,
          OR: [{ guildId: null }, { guildId: input.guildId }],
        },
        select: {
          id: true,
          guildId: true,
          name: true,
          description: true,
          kind: true,
          price: true,
          enabled: true,
          stackable: true,
          metadata: true,
        },
      })

      if (!item) return { success: false as const, error: 'item_not_found' }
      if (!item.enabled) return { success: false as const, error: 'item_disabled' }
      if (item.price < 0n) return { success: false as const, error: 'invalid_price' }

      // Ensure wallet exists
      const wallet = await tx.wallet.upsert({
        where: { userId: input.userId },
        update: {},
        create: { userId: input.userId, balance: 0n },
        select: { balance: true },
      })

      const total = item.price * BigInt(quantity)

      if (wallet.balance < total) {
        return { success: false as const, error: 'insufficient_funds' }
      }

      const updated_wallet = await tx.wallet.update({
        where: { userId: input.userId },
        data: { balance: { decrement: total } },
        select: { balance: true },
      })

      const purchase = await tx.purchase.create({
        data: {
          userId: input.userId,
          guildId: input.guildId,
          shopItemId: item.id,
          quantity,
          total,
        },
        select: { id: true },
      })

      const inventory_item_ids: string[] = []

      if (item.stackable) {
        const created = await tx.inventoryItem.create({
          data: {
            userId: input.userId,
            guildId: input.guildId,
            purchaseId: purchase.id,
            shopItemId: item.id,
            kind: item.kind,
            title: item.name,
            description: item.description,
            quantity,
            usedQuantity: 0,
            metadata: item.metadata as Prisma.InputJsonValue,
          },
          select: { id: true },
        })

        inventory_item_ids.push(created.id)
      } else {
        for (let i = 0; i < quantity; i++) {
          const created = await tx.inventoryItem.create({
            data: {
              userId: input.userId,
              guildId: input.guildId,
              purchaseId: purchase.id,
              shopItemId: item.id,
              kind: item.kind,
              title: item.name,
              description: item.description,
              quantity: 1,
              usedQuantity: 0,
              metadata: item.metadata as Prisma.InputJsonValue,
            },
            select: { id: true },
          })
          inventory_item_ids.push(created.id)
        }
      }

      await tx.luazinhaTransaction.create({
        data: {
          type: 'shop_purchase',
          amount: total,
          fromUserId: input.userId,
          guildId: input.guildId,
          reason: input.reason ?? null,
          metadata: {
            shopItemId: item.id,
            purchaseId: purchase.id,
            quantity,
            kind: item.kind,
          } satisfies Prisma.InputJsonObject,
        },
      })

      return {
        success: true as const,
        purchaseId: purchase.id,
        inventoryItemIds: inventory_item_ids,
        balance: updated_wallet.balance,
        total,
      }
    })
  }
}

export const shopService = new ShopService()
