import type { Guild, GuildMember, Message } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'

type autorole_config = {
  enabled: boolean
  delaySeconds: number
  onlyAfterFirstMessage: boolean
  roleIds: string[]
}

function normalize_config(config: { enabled: boolean; delaySeconds: number; onlyAfterFirstMessage: boolean } | null): Omit<
  autorole_config,
  'roleIds'
> {
  return {
    enabled: config?.enabled ?? false,
    delaySeconds: config?.delaySeconds ?? 0,
    onlyAfterFirstMessage: config?.onlyAfterFirstMessage ?? false,
  }
}

export class AutoroleService {
  private config_cache: Map<string, { config: autorole_config; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private async get_guild_config(guild_id: string): Promise<autorole_config> {
    const cached = this.config_cache.get(guild_id)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config
    }

    const config_row = await prisma.guildAutoroleConfig.findUnique({
      where: { guildId: guild_id },
      select: {
        id: true,
        enabled: true,
        delaySeconds: true,
        onlyAfterFirstMessage: true,
      },
    })

    if (!config_row) {
      const config: autorole_config = {
        enabled: false,
        delaySeconds: 0,
        onlyAfterFirstMessage: false,
        roleIds: [],
      }

      this.config_cache.set(guild_id, { config, timestamp: now })
      return config
    }

    const roles = await prisma.guildAutoroleRole.findMany({
      where: { guildId: guild_id, configId: config_row.id },
      select: { roleId: true },
    })

    const config: autorole_config = {
      ...normalize_config(config_row),
      roleIds: roles.map((r) => r.roleId),
    }

    this.config_cache.set(guild_id, { config, timestamp: now })
    return config
  }

  clear_cache(guild_id: string) {
    this.config_cache.delete(guild_id)
  }

  private async upsert_pending(input: {
    guildId: string
    userId: string
    waitForFirstMessage: boolean
    executeAt: Date | null
    lastError?: string | null
    attempts_increment?: boolean
  }) {
    const { guildId, userId, waitForFirstMessage, executeAt } = input

    await prisma.guildAutorolePending.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      update: {
        waitForFirstMessage,
        executeAt,
        ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
        ...(input.attempts_increment ? { attempts: { increment: 1 } } : {}),
      },
      create: {
        guildId,
        userId,
        waitForFirstMessage,
        executeAt,
        lastError: input.lastError ?? null,
      },
    })
  }

  private async try_apply_roles(guild: Guild, user_id: string, role_ids: string[]): Promise<void> {
    const member = await guild.members.fetch(user_id)

    if (!member.manageable) {
      throw new Error('member is not manageable by the bot (role hierarchy / permissions)')
    }

    await member.roles.add(role_ids, 'autorole')
  }

  async handle_member_add(member: GuildMember): Promise<void> {
    const guild_id = member.guild.id
    const user_id = member.user.id

    const config = await this.get_guild_config(guild_id)
    if (!config.enabled || config.roleIds.length === 0) {
      return
    }

    if (config.onlyAfterFirstMessage) {
      await this.upsert_pending({
        guildId: guild_id,
        userId: user_id,
        waitForFirstMessage: true,
        executeAt: null,
      })
      return
    }

    if (config.delaySeconds > 0) {
      await this.upsert_pending({
        guildId: guild_id,
        userId: user_id,
        waitForFirstMessage: false,
        executeAt: new Date(Date.now() + config.delaySeconds * 1000),
      })
      return
    }

    try {
      await this.try_apply_roles(member.guild, user_id, config.roleIds)

      await prisma.guildAutorolePending.deleteMany({
        where: {
          guildId: guild_id,
          userId: user_id,
        },
      })
    } catch (error) {
      const err = error as Error
      logger.warn({ err, guildId: guild_id, userId: user_id }, 'Falha ao aplicar autorole imediato; criando pendência')

      await this.upsert_pending({
        guildId: guild_id,
        userId: user_id,
        waitForFirstMessage: false,
        executeAt: new Date(Date.now() + 60 * 1000),
        lastError: err.message,
        attempts_increment: true,
      })
    }
  }

  async handle_message(message: Message): Promise<void> {
    if (!message.guild) return

    const guild_id = message.guild.id
    const user_id = message.author.id

    const pending = await prisma.guildAutorolePending.findUnique({
      where: {
        guildId_userId: {
          guildId: guild_id,
          userId: user_id,
        },
      },
      select: {
        id: true,
        waitForFirstMessage: true,
      },
    })

    if (!pending?.waitForFirstMessage) {
      return
    }

    const config = await this.get_guild_config(guild_id)

    if (!config.enabled || config.roleIds.length === 0) {
      await prisma.guildAutorolePending.deleteMany({
        where: {
          guildId: guild_id,
          userId: user_id,
        },
      })
      return
    }

    const execute_at = config.delaySeconds > 0 ? new Date(Date.now() + config.delaySeconds * 1000) : new Date()

    await this.upsert_pending({
      guildId: guild_id,
      userId: user_id,
      waitForFirstMessage: false,
      executeAt: execute_at,
    })

    if (config.delaySeconds > 0) {
      return
    }

    try {
      await this.try_apply_roles(message.guild, user_id, config.roleIds)
      await prisma.guildAutorolePending.delete({ where: { id: pending.id } })
    } catch (error) {
      const err = error as Error
      logger.warn({ err, guildId: guild_id, userId: user_id }, 'Falha ao aplicar autorole após primeira mensagem')

      await this.upsert_pending({
        guildId: guild_id,
        userId: user_id,
        waitForFirstMessage: false,
        executeAt: new Date(Date.now() + 60 * 1000),
        lastError: err.message,
        attempts_increment: true,
      })
    }
  }

  async process_due(client_guild_fetch: (guild_id: string) => Promise<Guild | null>): Promise<void> {
    const now = new Date()

    const due = await prisma.guildAutorolePending.findMany({
      where: {
        waitForFirstMessage: false,
        OR: [{ executeAt: null }, { executeAt: { lte: now } }],
      },
      take: 200,
      orderBy: [{ executeAt: 'asc' }, { updatedAt: 'asc' }],
    })

    for (const pending of due) {
      const guild_id = pending.guildId
      const user_id = pending.userId

      try {
        const config = await this.get_guild_config(guild_id)
        if (!config.enabled || config.roleIds.length === 0) {
          await prisma.guildAutorolePending.delete({ where: { id: pending.id } })
          continue
        }

        const guild = await client_guild_fetch(guild_id)
        if (!guild) {
          const attempts = pending.attempts + 1
          const backoff_seconds = Math.min(60 * attempts, 60 * 60)

          if (attempts >= 10) {
            await prisma.guildAutorolePending.delete({ where: { id: pending.id } })
            continue
          }

          await prisma.guildAutorolePending.update({
            where: { id: pending.id },
            data: {
              attempts,
              lastError: 'guild not found (client fetch returned null)',
              executeAt: new Date(Date.now() + backoff_seconds * 1000),
            },
          })

          continue
        }

        await this.try_apply_roles(guild, user_id, config.roleIds)
        await prisma.guildAutorolePending.delete({ where: { id: pending.id } })
      } catch (error) {
        const err = error as Error

        const attempts = pending.attempts + 1
        const backoff_seconds = Math.min(60 * attempts, 60 * 60)

        await prisma.guildAutorolePending.update({
          where: { id: pending.id },
          data: {
            attempts,
            lastError: err.message,
            executeAt: new Date(Date.now() + backoff_seconds * 1000),
          },
        })

        logger.warn({ err, guildId: guild_id, userId: user_id, attempts }, 'Falha ao processar autorole pendente')
      }
    }
  }
}

export const autoroleService = new AutoroleService()
