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

class AutoroleService {
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
    logger.debug({ guildId: guild.id, userId: user_id, roleIds: role_ids }, 'Tentando aplicar cargos de autorole')

    let member
    try {
      member = await guild.members.fetch(user_id)
      logger.debug({ guildId: guild.id, userId: user_id }, 'Membro recuperado com sucesso')
    } catch (error) {
      logger.warn({ guildId: guild.id, userId: user_id, error }, 'Falha ao buscar membro do guild')
      throw new Error('failed to fetch member from guild', { cause: error })
    }

    if (!member) {
      logger.warn({ guildId: guild.id, userId: user_id }, 'Membro não encontrado no guild')
      throw new Error('member not found in guild')
    }

    if (!member.manageable) {
      logger.warn({ guildId: guild.id, userId: user_id }, 'Membro não pode ser gerenciado pelo bot (hierarquia de cargos / permissões)')
      throw new Error('member is not manageable by the bot (role hierarchy / permissions)')
    }

    if (role_ids.length === 0) {
      logger.warn({ guildId: guild.id, userId: user_id }, 'Nenhum cargo para aplicar')
      throw new Error('no roles to apply')
    }

    try {
      logger.info({ guildId: guild.id, userId: user_id, roleIds: role_ids }, 'Adicionando cargos ao membro')
      await member.roles.add(role_ids, 'autorole')
      logger.info({ guildId: guild.id, userId: user_id, roleIds: role_ids }, 'Cargos adicionados com sucesso')
    } catch (error) {
      logger.error({ guildId: guild.id, userId: user_id, error }, 'Falha ao adicionar cargos')
      throw new Error(`failed to add roles: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
    }
  }

  async handle_member_add(member: GuildMember): Promise<void> {
    const guild_id = member.guild.id
    const user_id = member.user.id

    logger.debug({ guildId: guild_id, userId: user_id }, 'handle_member_add chamado para autorole')

    const config = await this.get_guild_config(guild_id)
    
    logger.debug({ guildId: guild_id, userId: user_id, config }, 'Configuração de autorole carregada')
    
    if (!config.enabled || config.roleIds.length === 0) {
      logger.debug({ guildId: guild_id, userId: user_id }, 'Autorole desativado ou sem cargos configurados')
      return
    }

    if (config.onlyAfterFirstMessage) {
      logger.info({ guildId: guild_id, userId: user_id }, 'Aguardando primeira mensagem para aplicar autorole')
      await this.upsert_pending({
        guildId: guild_id,
        userId: user_id,
        waitForFirstMessage: true,
        executeAt: null,
      })
      return
    }

    if (config.delaySeconds > 0) {
      logger.info({ guildId: guild_id, userId: user_id, delaySeconds: config.delaySeconds }, 'Agendando autorole com delay')
      await this.upsert_pending({
        guildId: guild_id,
        userId: user_id,
        waitForFirstMessage: false,
        executeAt: new Date(Date.now() + config.delaySeconds * 1000),
      })
      return
    }

    logger.info({ guildId: guild_id, userId: user_id }, 'Aplicando autorole imediatamente na entrada')
    try {
      await this.try_apply_roles(member.guild, user_id, config.roleIds)
      logger.info({ guildId: guild_id, userId: user_id, roleIds: config.roleIds }, 'Autorole aplicado com sucesso')

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

    logger.debug({ guildId: guild_id, userId: user_id }, 'handle_message chamado para autorole')

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
      logger.debug({ guildId: guild_id, userId: user_id }, 'Nenhuma pendência de autorole aguardando primeira mensagem')
      return
    }

    logger.debug({ guildId: guild_id, userId: user_id }, 'Pendência de autorole encontrada, processando...')

    const config = await this.get_guild_config(guild_id)

    if (!config.enabled || config.roleIds.length === 0) {
      logger.debug({ guildId: guild_id, userId: user_id }, 'Autorole desativado ou sem cargos configurados')
      await prisma.guildAutorolePending.deleteMany({
        where: {
          guildId: guild_id,
          userId: user_id,
        },
      })
      return
    }

    logger.debug({ guildId: guild_id, userId: user_id, config }, 'Configuração de autorole carregada')

    // Se delaySeconds é 0, aplicamos os cargos imediatamente após a primeira mensagem
    if (config.delaySeconds === 0) {
      logger.info({ guildId: guild_id, userId: user_id }, 'Aplicando autorole imediatamente após primeira mensagem')
      try {
        await this.try_apply_roles(message.guild, user_id, config.roleIds)
        logger.info({ guildId: guild_id, userId: user_id, roleIds: config.roleIds }, 'Autorole aplicado com sucesso')
        await prisma.guildAutorolePending.delete({ where: { id: pending.id } })
      } catch (error) {
        const err = error as Error
        logger.warn({ err, guildId: guild_id, userId: user_id }, 'Falha ao aplicar autorole após primeira mensagem')

        // Se o membro não estiver no guild ou não for gerenciável, tentamos novamente em 1 minuto
        // Isso pode acontecer se o membro acabou de entrar e ainda não está no cache
        await this.upsert_pending({
          guildId: guild_id,
          userId: user_id,
          waitForFirstMessage: false,
          executeAt: new Date(Date.now() + 60 * 1000),
          lastError: err.message,
          attempts_increment: true,
        })
      }
      return
    }

    // Se delaySeconds > 0, agendamos para o futuro
    logger.info({ guildId: guild_id, userId: user_id, delaySeconds: config.delaySeconds }, 'Agendando autorole para o futuro')
    const execute_at = new Date(Date.now() + config.delaySeconds * 1000)

    await this.upsert_pending({
      guildId: guild_id,
      userId: user_id,
      waitForFirstMessage: false,
      executeAt: execute_at,
    })
  }

  async process_due(client_guild_fetch: (guild_id: string) => Promise<Guild | null>): Promise<void> {
    const now = new Date()

    logger.debug('Buscando autoroles pendentes para processamento')

    const due = await prisma.guildAutorolePending.findMany({
      where: {
        waitForFirstMessage: false,
        OR: [{ executeAt: null }, { executeAt: { lte: now } }],
      },
      take: 200,
      orderBy: [{ executeAt: 'asc' }, { updatedAt: 'asc' }],
    })

    logger.debug({ count: due.length }, `Encontrados ${due.length} autoroles pendentes para processamento`)

    for (const pending of due) {
      const guild_id = pending.guildId
      const user_id = pending.userId

      logger.debug({ guildId: guild_id, userId: user_id, attempts: pending.attempts }, 'Processando autorole pendente')

      try {
        const config = await this.get_guild_config(guild_id)
        if (!config.enabled || config.roleIds.length === 0) {
          logger.debug({ guildId: guild_id, userId: user_id }, 'Autorole desativado ou sem cargos, removendo pendência')
          await prisma.guildAutorolePending.delete({ where: { id: pending.id } })
          continue
        }

        const guild = await client_guild_fetch(guild_id)
        if (!guild) {
          logger.warn({ guildId: guild_id, userId: user_id }, 'Guild não encontrada, aplicando backoff')
          const attempts = pending.attempts + 1
          const backoff_seconds = Math.min(60 * attempts, 60 * 60)

          if (attempts >= 10) {
            logger.warn({ guildId: guild_id, userId: user_id }, 'Máximo de tentativas atingido, removendo pendência')
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

        logger.info({ guildId: guild_id, userId: user_id, roleIds: config.roleIds }, 'Aplicando autorole pendente')
        await this.try_apply_roles(guild, user_id, config.roleIds)
        logger.info({ guildId: guild_id, userId: user_id }, 'Autorole pendente aplicado com sucesso')
        await prisma.guildAutorolePending.delete({ where: { id: pending.id } })
      } catch (error) {
        const err = error as Error
        logger.warn({ err, guildId: guild_id, userId: user_id }, 'Falha ao processar autorole pendente')

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

    logger.debug('Processamento de autoroles pendentes concluído')
  }
}

export const autoroleService = new AutoroleService()
