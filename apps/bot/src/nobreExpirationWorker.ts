import { Client } from 'discord.js'
import { prisma } from '@yuebot/database'
import { supportService } from './services/support/support.service'
import { logger } from './utils/logger'
import { safe_error_details } from './utils/safe_error'

// Expire native entitlements through existing transactional outbox, without a
// second Gateway session. The primary bot's outbox worker delivers the events.
async function main() {
  if (process.env.VB_SHARED_NOBRE_WORKER_ENABLED !== '1') throw Error('expiration_worker_disabled')
  if (!process.env.DISCORD_TOKEN) throw Error('discord_token_missing')
  const client = new Client({intents: []})
  client.rest.setToken(process.env.DISCORD_TOKEN)
  try {
    await supportService.run_expiration_batch(client)
    logger.info('Nobre native expiration enqueued')
  } finally {
    client.destroy()
  }
}
void main().catch(error => {
  logger.error({err: safe_error_details(error)}, 'Nobre native expiration failed')
  process.exitCode = 1
}).finally(async () => {await prisma.$disconnect()})
