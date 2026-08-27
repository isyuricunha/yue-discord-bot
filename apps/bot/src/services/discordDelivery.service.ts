import { Prisma } from '@yuebot/database'

type delivery_db = {
  discordDelivery: {
    upsert: (args: Prisma.DiscordDeliveryUpsertArgs) => Promise<unknown>
    updateMany: (args: Prisma.DiscordDeliveryUpdateManyArgs) => Promise<{ count: number }>
  }
}

export type discord_delivery_input = {
  dedupeKey: string
  kind: string
  guildId?: string | null
  userId?: string | null
  channelId?: string | null
  payload: unknown
  availableAt?: Date
}

function serialize_payload(payload: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue
}

export async function enqueue_discord_delivery(db: delivery_db, input: discord_delivery_input): Promise<void> {
  const payload = serialize_payload(input.payload)

  await db.discordDelivery.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: {
      dedupeKey: input.dedupeKey,
      kind: input.kind,
      guildId: input.guildId ?? null,
      userId: input.userId ?? null,
      channelId: input.channelId ?? null,
      payload,
      availableAt: input.availableAt ?? new Date(),
    },
  })
}

export async function reopen_discord_delivery(
  db: delivery_db,
  input: discord_delivery_input,
): Promise<boolean> {
  const payload = serialize_payload(input.payload)
  const reopened = await db.discordDelivery.updateMany({
    where: {
      dedupeKey: input.dedupeKey,
      deliveredAt: null,
      failedAt: { not: null },
    },
    data: {
      kind: input.kind,
      guildId: input.guildId ?? null,
      userId: input.userId ?? null,
      channelId: input.channelId ?? null,
      payload,
      availableAt: input.availableAt ?? new Date(),
      claimedAt: null,
      failedAt: null,
      attempts: 0,
      lastError: null,
    },
  })

  return reopened.count > 0
}
