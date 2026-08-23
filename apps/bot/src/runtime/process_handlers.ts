import { logger } from '../utils/logger'
import type { BotRuntime } from './create_bot_runtime'

type process_like = Pick<NodeJS.Process, 'once' | 'on' | 'exit'>

export type runtime_terminator = (
  reason: string,
  exit_code: number,
  error?: unknown
) => void

export function install_process_handlers(
  runtime: BotRuntime,
  target: process_like = process
): runtime_terminator {
  let terminating = false

  const terminate: runtime_terminator = (reason, exit_code, error) => {
    if (terminating) return
    terminating = true

    if (error !== undefined) {
      logger.error({ error, reason }, 'Fatal bot process error')
    }

    void runtime.shutdown(reason)
      .catch((shutdown_error) => {
        logger.error({ error: shutdown_error }, 'Bot shutdown failed')
      })
      .finally(() => {
        target.exit(exit_code)
      })
  }

  target.once('SIGINT', () => terminate('SIGINT', 0))
  target.once('SIGTERM', () => terminate('SIGTERM', 0))

  target.on('unhandledRejection', (error) => {
    terminate('unhandledRejection', 1, error)
  })

  target.on('uncaughtException', (error) => {
    terminate('uncaughtException', 1, error)
  })

  return terminate
}
