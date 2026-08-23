import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import {
  guildAnnouncementConfigSchema,
  guildGiveawayConfigSchema,
  guildSettingsConfigSchema,
  guildWelcomeConfigSchema,
} from '@yuebot/shared'
import { validation_error_details } from '../../utils/validation_error'
import { requireGuildAccess, requireGuildAdmin } from './authorization'

export async function guildSettingsRoutes(fastify: FastifyInstance) {
  const access = [fastify.authenticate, requireGuildAccess]
  const admin = [fastify.authenticate, requireGuildAdmin]

  fastify.get('/:guildId/welcome-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: {
          welcomeChannelId: true,
          leaveChannelId: true,
          welcomeMessage: true,
          leaveMessage: true,
        },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))

    return reply.send({
      success: true,
      config: {
        welcomeChannelId: config.welcomeChannelId,
        leaveChannelId: config.leaveChannelId,
        welcomeMessage: config.welcomeMessage,
        leaveMessage: config.leaveMessage,
      },
    })
  })

  fastify.put('/:guildId/welcome-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildWelcomeConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const updated = await prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        ...(input.welcomeChannelId !== undefined ? { welcomeChannelId: input.welcomeChannelId } : {}),
        ...(input.leaveChannelId !== undefined ? { leaveChannelId: input.leaveChannelId } : {}),
        ...(input.welcomeMessage !== undefined ? { welcomeMessage: input.welcomeMessage } : {}),
        ...(input.leaveMessage !== undefined ? { leaveMessage: input.leaveMessage } : {}),
      },
      create: {
        guildId,
        welcomeChannelId: input.welcomeChannelId ?? null,
        leaveChannelId: input.leaveChannelId ?? null,
        welcomeMessage: input.welcomeMessage ?? null,
        leaveMessage: input.leaveMessage ?? null,
      },
      select: {
        welcomeChannelId: true,
        leaveChannelId: true,
        welcomeMessage: true,
        leaveMessage: true,
      },
    })

    return reply.send({ success: true, config: updated })
  })

  fastify.get('/:guildId/announcement-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: { announcementChannelId: true },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))

    return reply.send({
      success: true,
      config: { announcementChannelId: config.announcementChannelId },
    })
  })

  fastify.put('/:guildId/announcement-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildAnnouncementConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const updated = await prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        ...(input.announcementChannelId !== undefined ? { announcementChannelId: input.announcementChannelId } : {}),
      },
      create: {
        guildId,
        announcementChannelId: input.announcementChannelId ?? null,
      },
      select: { announcementChannelId: true },
    })

    return reply.send({ success: true, config: updated })
  })

  fastify.get('/:guildId/giveaway-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: { giveawayChannelId: true },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))

    return reply.send({
      success: true,
      config: { giveawayChannelId: config.giveawayChannelId },
    })
  })

  fastify.put('/:guildId/giveaway-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildGiveawayConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const updated = await prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        ...(input.giveawayChannelId !== undefined ? { giveawayChannelId: input.giveawayChannelId } : {}),
      },
      create: {
        guildId,
        giveawayChannelId: input.giveawayChannelId ?? null,
      },
      select: { giveawayChannelId: true },
    })

    return reply.send({ success: true, config: updated })
  })

  fastify.get('/:guildId/settings-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: {
          prefix: true,
          locale: true,
          timezone: true,
          auditLogChannelId: true,
        },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))

    return reply.send({
      success: true,
      config: {
        prefix: config.prefix ?? '/',
        locale: config.locale ?? 'pt-BR',
        timezone: config.timezone ?? 'America/Sao_Paulo',
        auditLogChannelId: config.auditLogChannelId,
      },
    })
  })

  fastify.put('/:guildId/settings-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = guildSettingsConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data
    const updated = await prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        ...(typeof input.prefix === 'string' ? { prefix: input.prefix } : {}),
        ...(typeof input.locale === 'string' ? { locale: input.locale } : {}),
        ...(typeof input.timezone === 'string' ? { timezone: input.timezone } : {}),
        ...(input.auditLogChannelId !== undefined ? { auditLogChannelId: input.auditLogChannelId } : {}),
      },
      create: {
        guildId,
        prefix: input.prefix ?? '/',
        locale: input.locale ?? 'pt-BR',
        timezone: input.timezone ?? 'America/Sao_Paulo',
        auditLogChannelId: input.auditLogChannelId ?? null,
      },
      select: {
        prefix: true,
        locale: true,
        timezone: true,
        auditLogChannelId: true,
      },
    })

    return reply.send({
      success: true,
      config: {
        prefix: updated.prefix ?? '/',
        locale: updated.locale ?? 'pt-BR',
        timezone: updated.timezone ?? 'America/Sao_Paulo',
        auditLogChannelId: updated.auditLogChannelId,
      },
    })
  })

  fastify.get('/:guildId/free-games-config', {
    preHandler: access,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const config = await prisma.freeGameNotification.findUnique({
      where: { guildId },
      select: {
        id: true,
        channelId: true,
        roleIds: true,
        platforms: true,
        giveawayTypes: true,
        isEnabled: true,
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return reply.send({
      success: true,
      config: {
        channelId: config?.channelId ?? null,
        roleIds: Array.isArray(config?.roleIds) ? (config.roleIds as string[]) : [],
        platforms: Array.isArray(config?.platforms) ? (config.platforms as string[]) : [],
        giveawayTypes: Array.isArray(config?.giveawayTypes) ? (config.giveawayTypes as string[]) : [],
        isEnabled: config?.isEnabled ?? true,
        lastCheckedAt: config?.lastCheckedAt ?? null,
      },
    })
  })

  fastify.put('/:guildId/free-games-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const body = request.body as {
      channelId?: string | null
      roleIds?: string[]
      platforms?: string[]
      giveawayTypes?: string[]
      isEnabled?: boolean
    }

    const updated = await prisma.freeGameNotification.upsert({
      where: { guildId },
      update: {
        ...(body.channelId !== undefined ? { channelId: body.channelId ?? null } : {}),
        ...(body.roleIds !== undefined ? { roleIds: body.roleIds } : {}),
        ...(body.platforms !== undefined ? { platforms: body.platforms } : {}),
        ...(body.giveawayTypes !== undefined ? { giveawayTypes: body.giveawayTypes } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
      },
      create: {
        guildId,
        channelId: body.channelId ?? null,
        roleIds: body.roleIds ?? [],
        platforms: body.platforms ?? [],
        giveawayTypes: body.giveawayTypes ?? [],
        isEnabled: body.isEnabled ?? true,
      },
      select: {
        id: true,
        channelId: true,
        roleIds: true,
        platforms: true,
        giveawayTypes: true,
        isEnabled: true,
        lastCheckedAt: true,
        updatedAt: true,
      },
    })

    return reply.send({
      success: true,
      config: {
        channelId: updated.channelId,
        roleIds: Array.isArray(updated.roleIds) ? (updated.roleIds as string[]) : [],
        platforms: Array.isArray(updated.platforms) ? (updated.platforms as string[]) : [],
        giveawayTypes: Array.isArray(updated.giveawayTypes) ? (updated.giveawayTypes as string[]) : [],
        isEnabled: updated.isEnabled,
        lastCheckedAt: updated.lastCheckedAt,
      },
    })
  })
}
