import { prisma } from '@yuebot/database'

import { CONFIG } from '../config'
import { check_bot_client_ready, check_bot_internal_api } from '../internal/readiness_client'

export type readiness_result = {
  status: 'ready' | 'not_ready'
  checks: {
    api: 'ok'
    database: 'ok' | 'failed'
    botInternalApi: 'ok' | 'failed' | 'disabled'
    botClient: 'ready' | 'not_ready' | 'disabled'
  }
  timestamp: string
}

type readiness_dependencies = {
  bot_enabled: boolean
  check_database: () => Promise<void>
  check_bot_internal_api: () => Promise<void>
  check_bot_client_ready: () => Promise<void>
  now: () => Date
}

const default_dependencies: readiness_dependencies = {
  bot_enabled: CONFIG.bot.enabled,
  check_database: async () => {
    await prisma.$queryRaw`SELECT 1`
  },
  check_bot_internal_api,
  check_bot_client_ready,
  now: () => new Date(),
}

export async function get_readiness(
  overrides: Partial<readiness_dependencies> = {}
): Promise<readiness_result> {
  const dependencies: readiness_dependencies = {
    ...default_dependencies,
    ...overrides,
  }

  const database_check = Promise.resolve().then(() => dependencies.check_database())

  const bot_internal_check = dependencies.bot_enabled
    ? Promise.resolve().then(() => dependencies.check_bot_internal_api())
    : Promise.resolve()

  const bot_client_check = dependencies.bot_enabled
    ? Promise.resolve().then(() => dependencies.check_bot_client_ready())
    : Promise.resolve()

  const [database, bot_internal, bot_client] = await Promise.allSettled([
    database_check,
    bot_internal_check,
    bot_client_check,
  ])

  const database_ok = database.status === 'fulfilled'
  const bot_internal_ok = !dependencies.bot_enabled || bot_internal.status === 'fulfilled'
  const bot_client_ok = !dependencies.bot_enabled || bot_client.status === 'fulfilled'
  const ready = database_ok && bot_internal_ok && bot_client_ok

  return {
    status: ready ? 'ready' : 'not_ready',
    checks: {
      api: 'ok',
      database: database_ok ? 'ok' : 'failed',
      botInternalApi: dependencies.bot_enabled
        ? (bot_internal_ok ? 'ok' : 'failed')
        : 'disabled',
      botClient: dependencies.bot_enabled
        ? (bot_client_ok ? 'ready' : 'not_ready')
        : 'disabled',
    },
    timestamp: dependencies.now().toISOString(),
  }
}
