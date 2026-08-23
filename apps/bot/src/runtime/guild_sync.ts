import type { Client } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { map_with_concurrency } from '../utils/concurrency'

const GUILD_SYNC_CONCURRENCY = 5

export async function prune_stale_guilds_from_database(discord_client: Client) {
  const current_ids = new Set(Array.from(discord_client.guilds.cache.keys()))

  try {
    const existing = await prisma.guild.findMany({ select: { id: true } })
    const stale_ids = existing
      .map((guild) => guild.id)
      .filter((id) => !current_ids.has(id))

    if (stale_ids.length === 0) return

    logger.info(`🧹 Removendo ${stale_ids.length} guild(s) stale do banco de dados...`)

    const result = await prisma.guild.deleteMany({
      where: {
        id: { in: stale_ids },
      },
    })

    logger.info(`✅ Guilds stale removidas: ${result.count}`)
  } catch (error) {
    logger.error({ error }, '❌ Erro ao remover guilds stale do banco')
  }
}

export async function sync_guilds_to_database(discord_client: Client) {
  const guilds = Array.from(discord_client.guilds.cache.values())
  const started_at = Date.now()
  let failed_count = 0

  logger.info(
    {
      guildCount: guilds.length,
      concurrency: GUILD_SYNC_CONCURRENCY,
    },
    '🔄 Sincronizando guilds no banco de dados...'
  )

  await map_with_concurrency(guilds, GUILD_SYNC_CONCURRENCY, async (guild) => {
    try {
      await prisma.guild.upsert({
        where: { id: guild.id },
        update: {
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
        },
        create: {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
        },
      })
    } catch (error) {
      failed_count += 1
      logger.error(
        { error, guildId: guild.id },
        '❌ Erro ao sincronizar guild no banco'
      )
    }
  })

  logger.info(
    {
      guildCount: guilds.length,
      failedCount: failed_count,
      durationMs: Date.now() - started_at,
    },
    '✅ Sincronização de guilds concluída'
  )
}
