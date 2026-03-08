import { Message } from 'discord.js'
import { prisma } from '@yuebot/database'
import { getSendableChannel } from '../utils/discord'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

class CustomCommandService {
  async handle_message(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false

    // Consider that custom commands might be prefixed by standard prefix or just triggers.
    // We will check if the message matches any registered custom command for this guild.
    // For performance, we could cache these, but lets query first.
    const content = message.content.trim()
    if (!content) return false

    // We fetch all custom commands for the guild
    try {
      const customCommands = await prisma.customCommand.findMany({
        where: { guildId: message.guild.id },
        select: { name: true, response: true }
      })

      if (customCommands.length === 0) return false

      // Check if message content matches either exactly or starts with prefix + command
      // We assume custom commands are usually triggered exactly as their name
      // e.g., name: "!regras" or just "regras"
      
      const matchedCommand = customCommands.find(c => {
         const trigger = c.name.toLowerCase()
         // Allow exact match or if it's used with command-like whitespace
         return content.toLowerCase() === trigger || content.toLowerCase().startsWith(`${trigger} `)
      })

      if (matchedCommand) {
        const sendableChannel = getSendableChannel(message.channel)
        if (sendableChannel) {
          await sendableChannel.send({
            content: matchedCommand.response,
            allowedMentions: { parse: ['users'] }
          })
        }
        return true
      }

      return false
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Failed to process custom commands')
      return false
    }
  }
}

export const customCommandService = new CustomCommandService()
