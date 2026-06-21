import type { Client } from 'discord.js'
import { logger } from '../../utils/logger'
import { safe_error_details } from '../../utils/safe_error'
import { supportService } from './support.service'

export class SupportScheduler {
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(private readonly client: Client) {}

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.run().catch((error) => {
        logger.error({ err: safe_error_details(error) }, 'Support scheduler failed')
      })
    }, 5 * 60 * 1000)

    void this.run().catch((error) => {
      logger.error({ err: safe_error_details(error) }, 'Support scheduler failed')
    })
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private async run() {
    if (this.running) return
    this.running = true
    try {
      await supportService.run_expiration_batch(this.client)
      await supportService.run_reminder_batch(this.client)
    } finally {
      this.running = false
    }
  }
}
