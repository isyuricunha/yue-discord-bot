import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import { prisma } from '@yuebot/database'
import { z } from 'zod'
import { is_guild_admin } from '../internal/bot_internal_api'
import { can_access_guild } from '../utils/guild_access'
import { validation_error_details } from '../utils/validation_error'

const paramsSchema = z.object({
  guildId: z.string().min(1)
})

const commandParamsSchema = z.object({
  guildId: z.string().min(1),
  commandId: z.string().min(1)
})

const createCommandSchema = z.object({
  name: z.string().trim().min(1, 'Nome do comando é obrigatório').max(50, 'Nome muito longo'),
  description: z.string().trim().max(200, 'Descrição muito longa').optional(),
  response: z.string().trim().min(1, 'Resposta não pode estar vazia').max(2000, 'Resposta muito longa')
})

const updateCommandSchema = createCommandSchema

type custom_commands_db = {
  guild: Pick<typeof prisma.guild, 'findUnique'>
  customCommand: Pick<
    typeof prisma.customCommand,
    'findMany' | 'findUnique' | 'findFirst' | 'create' | 'update' | 'delete'
  >
}

type admin_check = (guildId: string, userId: string, log: FastifyBaseLogger) => Promise<{ isAdmin: boolean }>

type custom_commands_route_deps = {
  db: custom_commands_db
  isGuildAdmin: admin_check
}

function send_validation_error(
  fastify: FastifyInstance,
  reply: FastifyReply,
  error: { flatten: () => unknown },
) {
  const details = validation_error_details(fastify, error)
  return reply.code(400).send(details ? { error: 'Invalid request', details } : { error: 'Invalid request' })
}

async function require_guild_admin(
  deps: custom_commands_route_deps,
  request: FastifyRequest,
  reply: FastifyReply,
  guildId: string
) {
  const user = request.user

  if (!can_access_guild(user, guildId)) {
    await reply.code(403).send({ error: 'Forbidden' })
    return false
  }

  const guild = await deps.db.guild.findUnique({
    where: { id: guildId },
    select: { id: true },
  })

  if (!guild) {
    await reply.code(404).send({ error: 'Guild not found' })
    return false
  }

  if (user.isOwner) return true

  const { isAdmin } = await deps.isGuildAdmin(guildId, user.userId, request.log)
  if (!isAdmin) {
    await reply.code(403).send({ error: 'Você precisa da permissão Gerenciar Servidor.' })
    return false
  }

  return true
}

export function createCustomCommandsRoutes(
  overrides: Partial<custom_commands_route_deps> = {}
): FastifyPluginAsync {
  const deps: custom_commands_route_deps = {
    db: overrides.db ?? prisma,
    isGuildAdmin: overrides.isGuildAdmin ?? is_guild_admin,
  }

  return async function customCommandsRoutes(fastify) {
  // GET /guilds/:guildId/custom-commands
  // Retorna todos os comandos da guilda
  fastify.get('/:guildId/custom-commands', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return send_validation_error(fastify, reply, parsedParams.error)
    }

    const { guildId } = parsedParams.data
    const isAuthorized = await require_guild_admin(deps, request, reply, guildId)
    if (!isAuthorized) return reply

    const commands = await deps.db.customCommand.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(commands)
  })

  // POST /guilds/:guildId/custom-commands
  // Cria um novo comando
  fastify.post('/:guildId/custom-commands', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return send_validation_error(fastify, reply, parsedParams.error)
    }

    const parsedBody = createCommandSchema.safeParse(request.body)
    if (!parsedBody.success) {
      return send_validation_error(fastify, reply, parsedBody.error)
    }

    const { guildId } = parsedParams.data
    const isAuthorized = await require_guild_admin(deps, request, reply, guildId)
    if (!isAuthorized) return reply

    const data = parsedBody.data

    // Impede nomes duplicados na mesma guilda
    const existing = await deps.db.customCommand.findUnique({
      where: { guildId_name: { guildId, name: data.name } }
    })

    if (existing) {
      return reply.status(400).send({ error: 'Um comando com este nome já existe nesta guilda.' })
    }

    const command = await deps.db.customCommand.create({
      data: {
        guildId,
        name: data.name,
        description: data.description,
        response: data.response
      }
    })

    return reply.status(201).send(command)
  })

  // PUT /guilds/:guildId/custom-commands/:commandId
  // Opção para atualizar
  fastify.put('/:guildId/custom-commands/:commandId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsedParams = commandParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return send_validation_error(fastify, reply, parsedParams.error)
    }

    const parsedBody = updateCommandSchema.safeParse(request.body)
    if (!parsedBody.success) {
      return send_validation_error(fastify, reply, parsedBody.error)
    }

    const { guildId, commandId } = parsedParams.data
    const isAuthorized = await require_guild_admin(deps, request, reply, guildId)
    if (!isAuthorized) return reply

    const commandToUpdate = await deps.db.customCommand.findUnique({
      where: { id: commandId },
      select: { guildId: true },
    })

    if (!commandToUpdate || commandToUpdate.guildId !== guildId) {
      return reply.status(404).send({ error: 'Comando não encontrado.' })
    }

    const data = parsedBody.data

    const existingName = await deps.db.customCommand.findFirst({
      where: { guildId, name: data.name, id: { not: commandId } }
    })

    if (existingName) {
       return reply.status(400).send({ error: 'Um comando com este nome já existe nesta guilda.' })
    }

    const command = await deps.db.customCommand.update({
      where: { id: commandId },
      data: {
        name: data.name,
        description: data.description,
        response: data.response
      }
    })

    return reply.send(command)
  })

  // DELETE /guilds/:guildId/custom-commands/:commandId
  // Deleta um comando customizado
  fastify.delete('/:guildId/custom-commands/:commandId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsedParams = commandParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return send_validation_error(fastify, reply, parsedParams.error)
    }

    const { guildId, commandId } = parsedParams.data
    const isAuthorized = await require_guild_admin(deps, request, reply, guildId)
    if (!isAuthorized) return reply

    const commandToDelete = await deps.db.customCommand.findUnique({
      where: { id: commandId },
      select: { guildId: true },
    })

    if (!commandToDelete || commandToDelete.guildId !== guildId) {
      return reply.status(404).send({ error: 'Comando não encontrado.' })
    }

    await deps.db.customCommand.delete({
       where: { id: commandId }
    })

    return reply.status(204).send()
  })
  }
}

export const customCommandsRoutes = createCustomCommandsRoutes()
