import { Prisma } from '@yuebot/database'

type delivery_db = {
  discordDelivery: {
    upsert: (args: Prisma.DiscordDeliveryUpsertArgs) => Promise<unknown>
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

export async function enqueue_discord_delivery(db: delivery_db, input: discord_delivery_input): Promise<void> {
  const payload = JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue

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
