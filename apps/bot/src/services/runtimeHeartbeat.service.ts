import type { Client } from 'discord.js'

import { logger } from '../utils/logger'

const RUNTIME_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000

export type runtime_heartbeat_snapshot = {
  discordReady: boolean
  guildCount: number
  userCount: number
  uptimeSeconds: number
}

export function build_runtime_heartbeat_snapshot(client: Client): runtime_heartbeat_snapshot {
  let user_count = 0
  for (const guild of client.guilds.cache.values()) {
    user_count += guild.memberCount
  }

  return {
    discordReady: client.isReady(),
    guildCount: client.guilds.cache.size,
    userCount: user_count,
    uptimeSeconds: Math.floor(process.uptime()),
  }
}

export class RuntimeHeartbeatService {
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly client: Client,
    private readonly interval_ms = RUNTIME_HEARTBEAT_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.timer) return

    this.timer = setInterval(() => this.emit(), this.interval_ms)
    this.timer.unref()

    logger.info(
      { intervalSeconds: Math.floor(this.interval_ms / 1000) },
      '💓 Runtime heartbeat iniciado',
    )
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private emit(): void {
    const snapshot = build_runtime_heartbeat_snapshot(this.client)

    if (snapshot.discordReady) {
      logger.info(snapshot, '💓 Yue runtime heartbeat')
      return
    }

    logger.warn(snapshot, '💔 Yue runtime heartbeat: Discord não está pronto')
  }
}
