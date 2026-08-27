import type { Message } from 'discord.js'

import { KeyedSerialExecutor } from '../utils/keyed-serial'
import { xpService } from './xp.service'

const xp_write_operations = new KeyedSerialExecutor()
let message_wrapper_installed = false

export function run_serialized_xp_write<T>(
  guild_id: string,
  user_id: string,
  operation: () => Promise<T>,
): Promise<T> {
  return xp_write_operations.run(`${guild_id}:${user_id}`, operation)
}

export function install_serialized_message_xp(): void {
  if (message_wrapper_installed) return
  message_wrapper_installed = true

  const original_handle_message = xpService.handle_message.bind(xpService)
  xpService.handle_message = async (message: Message): Promise<void> => {
    const guild_id = message.guild?.id
    if (!guild_id) {
      await original_handle_message(message)
      return
    }

    await run_serialized_xp_write(guild_id, message.author.id, async () => {
      await original_handle_message(message)
    })
  }
}
