import { createBotRuntime } from './runtime/create_bot_runtime'

export const bot_runtime = createBotRuntime()
export const client = bot_runtime.client
