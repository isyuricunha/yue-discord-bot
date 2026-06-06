import { Message } from 'discord.js'
import { prisma } from '@yuebot/database'
import { getSendableChannel } from '../utils/discord'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

type custom_command = {
  name: string
  response: string
}

type custom_command_db = {
  customCommand: {
    findMany: (args: {
      where: { guildId: string }
      select: { name: true; response: true }
    }) => Promise<custom_command[]>
  }
}

type custom_command_cache_entry = {
  commands: custom_command[]
  expires_at: number
}

const DEFAULT_CACHE_TTL_MS = 10_000
const MAX_CACHE_ENTRIES = 500

function parse_cache_ttl_ms(value: string | undefined): number {
  if (!value) return DEFAULT_CACHE_TTL_MS
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CACHE_TTL_MS
  return parsed
}

export function find_matching_custom_command(
  commands: custom_command[],
  raw_content: string
): custom_command | null {
  const content = raw_content.trim().toLowerCase()
  if (!content) return null

  return commands.find((command) => {
    const trigger = command.name.toLowerCase()
    return content === trigger || content.startsWith(`${trigger} `)
  }) ?? null
}

export class CustomCommandService {
  private readonly cache = new Map<string, custom_command_cache_entry>()
  private readonly cache_ttl_ms: number

  constructor(
    private readonly db: custom_command_db = prisma,
    options: { cache_ttl_ms?: number } = {}
  ) {
    this.cache_ttl_ms = options.cache_ttl_ms ?? parse_cache_ttl_ms(process.env.CUSTOM_COMMAND_CACHE_TTL_MS)
  }

  clear_cache() {
    this.cache.clear()
  }

  invalidate_guild(guildId: string) {
    this.cache.delete(guildId)
  }

  private prune_cache() {
    const now = Date.now()

    for (const [guildId, entry] of this.cache.entries()) {
      if (entry.expires_at <= now) {
        this.cache.delete(guildId)
      }
    }

    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const first = this.cache.keys().next()
      if (first.done) break
      this.cache.delete(first.value)
    }
  }

  private async get_commands_for_guild(guildId: string): Promise<custom_command[]> {
    if (this.cache_ttl_ms > 0) {
      const cached = this.cache.get(guildId)
      if (cached && cached.expires_at > Date.now()) {
        return cached.commands
      }
    }

    const commands = await this.db.customCommand.findMany({
      where: { guildId },
      select: { name: true, response: true }
    })

    if (this.cache_ttl_ms > 0) {
      this.prune_cache()
      this.cache.set(guildId, {
        commands,
        expires_at: Date.now() + this.cache_ttl_ms,
      })
    }

    return commands
  }

  async handle_message(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false

    const content = message.content.trim()
    if (!content) return false

    try {
      const customCommands = await this.get_commands_for_guild(message.guild.id)

      if (customCommands.length === 0) return false

      const matchedCommand = find_matching_custom_command(customCommands, content)

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
