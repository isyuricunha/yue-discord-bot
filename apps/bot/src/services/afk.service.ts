import { prisma } from '@yuebot/database'
import { BoundedTtlCache } from '../utils/bounded_ttl_cache'

export type user_afk = {
  id: string
  userId: string
  guildId: string
  reason: string | null
  startedAt: Date
  isAfk: boolean
}

type AfkDb = {
  userAfk: Pick<typeof prisma.userAfk, 'upsert' | 'findUnique' | 'findMany' | 'delete'>
}

type cached_afk = { value: user_afk | null }

export function findFirstActiveAfk(userIds: string[], afks: user_afk[]): user_afk | null {
  const afkByUserId = new Map(
    afks
      .filter((afk) => afk.isAfk)
      .map((afk) => [afk.userId, afk] as const)
  )

  for (const userId of userIds) {
    const afk = afkByUserId.get(userId)
    if (afk) return afk
  }

  return null
}

export class AfkService {
  private readonly cache: BoundedTtlCache<string, cached_afk>

  constructor(
    private readonly db: AfkDb = prisma,
    options: { cache_ttl_ms?: number; max_entries?: number } = {},
  ) {
    this.cache = new BoundedTtlCache({
      ttl_ms: options.cache_ttl_ms ?? 30_000,
      max_entries: options.max_entries ?? 20_000,
    })
  }

  private key(userId: string, guildId: string): string {
    return `${guildId}:${userId}`
  }

  async setAfk(userId: string, guildId: string, reason: string | null): Promise<user_afk> {
    const afk = await this.db.userAfk.upsert({
      where: { userId_guildId: { userId, guildId } },
      update: { reason, startedAt: new Date(), isAfk: true },
      create: { userId, guildId, reason, isAfk: true },
    })
    this.cache.set(this.key(userId, guildId), { value: afk })
    return afk
  }

  async removeAfk(userId: string, guildId: string): Promise<user_afk | null> {
    const afk = await this.getAfk(userId, guildId)
    if (!afk) return null

    await this.db.userAfk.delete({
      where: { userId_guildId: { userId, guildId } },
    })
    this.cache.set(this.key(userId, guildId), { value: null })
    return afk
  }

  async getAfk(userId: string, guildId: string): Promise<user_afk | null> {
    const key = this.key(userId, guildId)
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached.value

    const afk = await this.db.userAfk.findUnique({
      where: { userId_guildId: { userId, guildId } },
    })
    this.cache.set(key, { value: afk })
    return afk
  }

  async getAfks(userIds: string[], guildId: string): Promise<user_afk[]> {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
    if (uniqueUserIds.length === 0) return []

    const resolved = new Map<string, user_afk | null>()
    const misses: string[] = []

    for (const userId of uniqueUserIds) {
      const cached = this.cache.get(this.key(userId, guildId))
      if (cached === undefined) misses.push(userId)
      else resolved.set(userId, cached.value)
    }

    if (misses.length > 0) {
      const rows = await this.db.userAfk.findMany({
        where: { guildId, userId: { in: misses } },
      })
      const byUserId = new Map(rows.map((row) => [row.userId, row] as const))

      for (const userId of misses) {
        const row = byUserId.get(userId) ?? null
        resolved.set(userId, row)
        this.cache.set(this.key(userId, guildId), { value: row })
      }
    }

    return uniqueUserIds
      .map((userId) => resolved.get(userId) ?? null)
      .filter((value): value is user_afk => value !== null)
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const afkService = new AfkService()

export function setAfk(userId: string, guildId: string, reason: string | null): Promise<user_afk> {
  return afkService.setAfk(userId, guildId, reason)
}

export function removeAfk(userId: string, guildId: string): Promise<user_afk | null> {
  return afkService.removeAfk(userId, guildId)
}

export function getAfk(userId: string, guildId: string): Promise<user_afk | null> {
  return afkService.getAfk(userId, guildId)
}
