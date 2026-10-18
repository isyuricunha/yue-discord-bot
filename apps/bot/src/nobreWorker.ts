import { Client } from 'discord.js'
import { prisma } from '@yuebot/database'
import { syncSharedNobre } from './services/support/sharedNobreSync'
import { logger } from './utils/logger'
import { safe_error_details } from './utils/safe_error'

/**
 * One-shot Nobre reconciliation over the Discord REST API.
 * This process deliberately NEVER logs in to the Discord gateway; it is safe
 * to run while the primary Yue bot remains connected.
 *
 * Activation is independent from the main bot's release flag and requires
 * VB_SHARED_NOBRE_WORKER_ENABLED=1 in the private worker environment.
 */
export async function runSharedNobreRestWorker() {
  if (process.env.VB_SHARED_NOBRE_WORKER_ENABLED !== '1') {
    throw new Error('nobre_worker_not_enabled')
  }
  const token = process.env.DISCORD_TOKEN
  if (!token) throw new Error('discord_token_missing')
  if (!process.env.VB_SHARED_NOBRE_ORIGIN ||
      !process.env.VB_SHARED_NOBRE_GUILD_ID ||
      !process.env.VB_SHARED_NOBRE_ROLE_ID ||
      (process.env.VB_SHARED_NOBRE_TOKEN?.length ?? 0) < 40) {
    throw new Error('shared_nobre_config_incomplete')
  }
  process.env.VB_SHARED_NOBRE_ENABLED = '1'
  const client = new Client({ intents: [] })
  client.rest.setToken(token)
  try {
    await syncSharedNobre(client)
    logger.info('Shared Nobre REST reconciliation complete')
  } finally {
    client.destroy()
  }
}

if (require.main === module) {
  void runSharedNobreRestWorker()
    .catch(error => {
      logger.error({ err: safe_error_details(error) }, 'Shared Nobre REST reconciliation failed')
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
