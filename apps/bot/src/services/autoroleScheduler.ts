import type { Client } from 'discord.js'
import { autoroleService } from './autorole.service'
import { logger } from '../utils/logger'

export class AutoroleScheduler {
  private interval: NodeJS.Timeout | null = null

  constructor(private client: Client) {}

  start() {
    this.interval = setInterval(() => {
      this.tick()
    }, 30 * 1000)

    this.tick()

    logger.info('🧩 Scheduler de autorole iniciado')
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
      logger.info('🧩 Scheduler de autorole parado')
    }
  }

  private async tick() {
    try {
      await autoroleService.process_due(async (guild_id) => {
        try {
          return await this.client.guilds.fetch(guild_id)
        } catch {
          return null
        }
      })
    } catch (error) {
      const err = error as Error
      logger.error({ err }, 'Erro ao processar scheduler de autorole')
    }
  }
}
