import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import {
  guildCommandCooldownsUpsertSchema,
  guildCommandOverridesUpsertSchema,
} from '@yuebot/shared'
import { get_bot_commands } from '../../internal/bot_internal_api'
import { safe_error_details } from '../../utils/safe_error'
import { validation_error_details } from '../../utils/validation_error'
import { requireGuildAdmin } from './authorization'

export async function guildCommandsRoutes(fastify: FastifyInstance) {
  const admin = [fastify.authenticate, requireGuildAdmin]

  fastify.get('/:guildId/commands', {
    preHandler: admin,
  }, async (request, reply) => {
    try {
      const commands = await get_bot_commands(request.log)
      return reply.send({ success: true, ...commands })
    } catch (error: unknown) {
      fastify.log.error({ err: safe_error_details(error) }, 'Failed to list bot commands')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.get('/:guildId/commands-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const overrides = await prisma.guildCommandOverride.findMany({
      where: { guildId },
      select: {
        commandType: true,
        commandName: true,
        enabled: true,
      },
      orderBy: [{ commandType: 'asc' }, { commandName: 'asc' }],
    })

    return reply.send({ success: true, overrides })
  })

  fastify.put('/:guildId/commands-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildCommandOverridesUpsertSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const ops = parsed.data.overrides.map((override) => {
      if (override.enabled) {
        return prisma.guildCommandOverride.deleteMany({
          where: {
            guildId,
            commandType: override.commandType,
            commandName: override.commandName,
          },
        })
      }

      return prisma.guildCommandOverride.upsert({
        where: {
          guildId_commandType_commandName: {
            guildId,
            commandType: override.commandType,
            commandName: override.commandName,
          },
        },
        update: { enabled: false },
        create: {
          guildId,
          commandType: override.commandType,
          commandName: override.commandName,
          enabled: false,
        },
      })
    })

    await prisma.$transaction(ops)

    const overrides = await prisma.guildCommandOverride.findMany({
      where: { guildId },
      select: {
        commandType: true,
        commandName: true,
        enabled: true,
      },
      orderBy: [{ commandType: 'asc' }, { commandName: 'asc' }],
    })

    return reply.send({ success: true, overrides })
  })

  fastify.get('/:guildId/commands-cooldowns', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const cooldowns = await prisma.guildCommandCooldown.findMany({
      where: { guildId },
      select: {
        commandName: true,
        cooldownSeconds: true,
      },
      orderBy: { commandName: 'asc' },
    })

    return reply.send({ success: true, cooldowns })
  })

  fastify.put('/:guildId/commands-cooldowns', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildCommandCooldownsUpsertSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.guildCommandCooldown.deleteMany({ where: { guildId } })

      const cooldowns_to_create = parsed.data.cooldowns
        .filter((cooldown) => cooldown.cooldownSeconds > 0)
        .map((cooldown) => ({
          guildId,
          commandName: cooldown.commandName,
          cooldownSeconds: cooldown.cooldownSeconds,
        }))

      if (cooldowns_to_create.length > 0) {
        await tx.guildCommandCooldown.createMany({ data: cooldowns_to_create })
      }
    })

    const cooldowns = await prisma.guildCommandCooldown.findMany({
      where: { guildId },
      select: {
        commandName: true,
        cooldownSeconds: true,
      },
      orderBy: { commandName: 'asc' },
    })

    return reply.send({ success: true, cooldowns })
  })
}
