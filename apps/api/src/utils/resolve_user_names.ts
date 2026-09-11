import { prisma } from '@yuebot/database'

type name_lookup_db = Pick<typeof prisma, 'guildMember'>

export type resolved_user = {
  userId: string
  username: string | null
  found: boolean
}

/**
 * Batch-resolves user IDs to usernames from the guild_members cache.
 * Users not found in the cache are returned with `found: false` and
 * `username: null`, so the caller can render the raw ID with a
 * "(saiu do servidor)" indicator.
 */
export async function resolve_user_names(
  db: name_lookup_db,
  guildId: string,
  userIds: string[],
): Promise<Map<string, resolved_user>> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))]
  if (unique.length === 0) return new Map()

  const rows = await db.guildMember.findMany({
    where: { guildId, userId: { in: unique } },
    select: { userId: true, username: true },
  })

  const username_by_id = new Map(rows.map((row) => [row.userId, row.username]))
  const result = new Map<string, resolved_user>()

  for (const userId of unique) {
    const username = username_by_id.get(userId) ?? null
    result.set(userId, { userId, username, found: username !== null })
  }

  return result
}
