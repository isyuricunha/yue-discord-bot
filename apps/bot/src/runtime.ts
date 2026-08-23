import { bot_runtime } from './index'
import { install_process_handlers } from './runtime/process_handlers'

const terminate = install_process_handlers(bot_runtime)

void bot_runtime.start().catch((error) => {
  terminate('startupFailure', 1, error)
})
