import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@yuebot/database'
import { z } from 'zod'

const paramsSchema = z.object({
  guildId: z.string()
})

const createCommandSchema = z.object({
  name: z.string().min(1, 'Nome do comando é obrigatório').max(50, 'Nome muito longo'),
  description: z.string().max(200, 'Descrição muito longa').optional(),
  response: z.string().min(1, 'Resposta não pode estar vazia').max(2000, 'Resposta muito longa')
})

const updateCommandSchema = createCommandSchema

export const customCommandsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /guilds/:guildId/custom-commands
  // Retorna todos os comandos da guilda
  fastify.get('/:guildId/custom-commands', async (request, reply) => {
    const { guildId } = paramsSchema.parse(request.params)

    const commands = await prisma.customCommand.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(commands)
  })

  // POST /guilds/:guildId/custom-commands
  // Cria um novo comando
  fastify.post('/:guildId/custom-commands', async (request, reply) => {
    const { guildId } = paramsSchema.parse(request.params)
    const data = createCommandSchema.parse(request.body)

    // Impede nomes duplicados na mesma guilda
    const existing = await prisma.customCommand.findUnique({
      where: { guildId_name: { guildId, name: data.name } }
    })

    if (existing) {
      return reply.status(400).send({ error: 'Um comando com este nome já existe nesta guilda.' })
    }

    const command = await prisma.customCommand.create({
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
  fastify.put('/:guildId/custom-commands/:commandId', async (request, reply) => {
    const { guildId, commandId } = z.object({
      guildId: z.string(),
      commandId: z.string()
    }).parse(request.params)

    const data = updateCommandSchema.parse(request.body)

    const existingName = await prisma.customCommand.findFirst({
      where: { guildId, name: data.name, id: { not: commandId } }
    })

    if (existingName) {
       return reply.status(400).send({ error: 'Um comando com este nome já existe nesta guilda.' })
    }

    const command = await prisma.customCommand.update({
      where: { id: commandId, guildId }, // garantindo que a guilda e o comando deem match
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
  fastify.delete('/:guildId/custom-commands/:commandId', async (request, reply) => {
    const { guildId, commandId } = z.object({
      guildId: z.string(),
      commandId: z.string()
    }).parse(request.params)

    await prisma.customCommand.delete({
       where: { id: commandId, guildId }
    })

    return reply.status(204).send()
  })
}
