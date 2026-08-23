import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import {
  get_suggestion_timeframe_start_date,
  parse_suggestion_timeframe,
  reactionRolePanelPublishSchema,
  reactionRolePanelUpsertSchema,
  starboardConfigSchema,
  suggestionConfigSchema,
  ticketConfigSchema,
  ticketPanelPublishSchema,
} from '@yuebot/shared'
import {
  publish_reaction_role_panel,
  publish_ticket_panel,
} from '../../internal/bot_internal_api'
import { public_error_message } from '../../utils/public_error'
import { safe_error_details } from '../../utils/safe_error'
import { validation_error_details } from '../../utils/validation_error'
import { requireGuildAdmin } from './authorization'

export async function guildCommunityRoutes(fastify: FastifyInstance) {
  const admin = [fastify.authenticate, requireGuildAdmin]

  fastify.get('/:guildId/suggestions/top', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const query = request.query as { timeframe?: string; limit?: string }
    const timeframe = parse_suggestion_timeframe(query.timeframe)
    if (!timeframe) {
      return reply.code(400).send({ error: 'Invalid timeframe' })
    }

    const limit_raw = query.limit ? Number(query.limit) : 25
    const limit = Number.isFinite(limit_raw) ? Math.min(Math.max(1, limit_raw), 100) : 25
    const since = get_suggestion_timeframe_start_date(timeframe, new Date())

    try {
      const items = await prisma.suggestion.findMany({
        where: { guildId, createdAt: { gte: since } },
        select: {
          id: true,
          userId: true,
          sourceChannelId: true,
          sourceMessageId: true,
          messageId: true,
          content: true,
          status: true,
          upvotes: true,
          downvotes: true,
          decidedAt: true,
          decidedByUserId: true,
          decisionNote: true,
          createdAt: true,
          updatedAt: true,
        },
        take: limit,
        orderBy: [{ upvotes: 'desc' }, { downvotes: 'asc' }, { createdAt: 'desc' }],
      })

      const sorted = items
        .slice()
        .sort((a, b) => {
          const score_a = a.upvotes - a.downvotes
          const score_b = b.upvotes - b.downvotes
          if (score_a !== score_b) return score_b - score_a
          if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes
          if (a.createdAt.getTime() !== b.createdAt.getTime()) {
            return b.createdAt.getTime() - a.createdAt.getTime()
          }
          return a.id.localeCompare(b.id)
        })
        .slice(0, limit)

      return { success: true, timeframe, since, suggestions: sorted }
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to list top suggestions')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.get('/:guildId/suggestion-config', {
    preHandler: admin,
  }, async (request) => {
    const { guildId } = request.params as { guildId: string }
    const config = await prisma.suggestionConfig.findUnique({
      where: { guildId },
      select: { enabled: true, channelId: true, logChannelId: true },
    })

    return {
      success: true,
      config: {
        enabled: config?.enabled ?? false,
        channelId: config?.channelId ?? null,
        logChannelId: config?.logChannelId ?? null,
      },
    }
  })

  fastify.put('/:guildId/suggestion-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = suggestionConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const data = parsed.data
    const updated = await prisma.suggestionConfig.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.channelId !== undefined ? { channelId: data.channelId ?? null } : {}),
        ...(data.logChannelId !== undefined ? { logChannelId: data.logChannelId ?? null } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        channelId: data.channelId ?? null,
        logChannelId: data.logChannelId ?? null,
      },
      select: { enabled: true, channelId: true, logChannelId: true },
    })

    return {
      success: true,
      config: {
        enabled: updated.enabled,
        channelId: updated.channelId,
        logChannelId: updated.logChannelId,
      },
    }
  })

  fastify.get('/:guildId/suggestions', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const query = request.query as { status?: string; limit?: string; cursor?: string }
    const status =
      query.status === 'pending' || query.status === 'accepted' || query.status === 'denied'
        ? query.status
        : undefined
    const limit_raw = query.limit ? Number(query.limit) : 25
    const limit = Number.isFinite(limit_raw) ? Math.min(Math.max(1, limit_raw), 100) : 25
    const cursor =
      typeof query.cursor === 'string' && query.cursor.trim().length > 0
        ? query.cursor.trim()
        : undefined

    try {
      const items = await prisma.suggestion.findMany({
        where: { guildId, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          userId: true,
          sourceChannelId: true,
          sourceMessageId: true,
          messageId: true,
          content: true,
          status: true,
          upvotes: true,
          downvotes: true,
          decidedAt: true,
          decidedByUserId: true,
          decisionNote: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      const nextCursor = items.length === limit ? items[items.length - 1]?.id : null
      return { success: true, suggestions: items, nextCursor }
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to list suggestions')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  fastify.get('/:guildId/ticket-config', {
    preHandler: admin,
  }, async (request) => {
    const { guildId } = request.params as { guildId: string }
    const config = await prisma.ticketConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        categoryId: true,
        logChannelId: true,
        supportRoleIds: true,
        panelChannelId: true,
        panelMessageId: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: config?.enabled ?? false,
        categoryId: config?.categoryId ?? null,
        logChannelId: config?.logChannelId ?? null,
        supportRoleIds: Array.isArray(config?.supportRoleIds) ? (config.supportRoleIds as string[]) : [],
        panelChannelId: config?.panelChannelId ?? null,
        panelMessageId: config?.panelMessageId ?? null,
      },
    }
  })

  fastify.put('/:guildId/ticket-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = ticketConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const data = parsed.data
    const updated = await prisma.ticketConfig.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId ?? null } : {}),
        ...(data.logChannelId !== undefined ? { logChannelId: data.logChannelId ?? null } : {}),
        ...(data.supportRoleIds !== undefined ? { supportRoleIds: data.supportRoleIds } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        categoryId: data.categoryId ?? null,
        logChannelId: data.logChannelId ?? null,
        supportRoleIds: data.supportRoleIds ?? [],
      },
      select: {
        enabled: true,
        categoryId: true,
        logChannelId: true,
        supportRoleIds: true,
        panelChannelId: true,
        panelMessageId: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: updated.enabled,
        categoryId: updated.categoryId,
        logChannelId: updated.logChannelId,
        supportRoleIds: Array.isArray(updated.supportRoleIds) ? (updated.supportRoleIds as string[]) : [],
        panelChannelId: updated.panelChannelId,
        panelMessageId: updated.panelMessageId,
      },
    }
  })

  fastify.get('/:guildId/tickets', {
    preHandler: admin,
  }, async (request) => {
    const { guildId } = request.params as { guildId: string }
    const query = request.query as { status?: string; limit?: string; cursor?: string }
    const status = query.status === 'open' || query.status === 'closed' ? query.status : undefined
    const limit_raw = query.limit ? Number(query.limit) : 25
    const limit = Number.isFinite(limit_raw) ? Math.min(Math.max(1, limit_raw), 100) : 25
    const cursor =
      typeof query.cursor === 'string' && query.cursor.trim().length > 0
        ? query.cursor.trim()
        : undefined

    const items = await prisma.ticket.findMany({
      where: { guildId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        userId: true,
        channelId: true,
        status: true,
        createdAt: true,
        closedAt: true,
        closedByUserId: true,
        closeReason: true,
      },
    })

    const nextCursor = items.length === limit ? items[items.length - 1]?.id : null
    return { success: true, tickets: items, nextCursor }
  })

  fastify.post('/:guildId/tickets/panel', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = ticketPanelPublishSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    try {
      const result = await publish_ticket_panel(
        {
          guildId,
          channelId: parsed.data.channelId,
          moderatorId: request.user.userId,
        },
        request.log
      )
      return reply.send({ success: true, messageId: result.messageId })
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to publish ticket panel via bot internal API')
      return reply.code(502).send({
        error: public_error_message(fastify, 'Failed to publish ticket panel', 'Bad gateway'),
      })
    }
  })

  fastify.get('/:guildId/reaction-roles/panels', {
    preHandler: admin,
  }, async (request) => {
    const { guildId } = request.params as { guildId: string }
    const panels = await prisma.reactionRolePanel.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        enabled: true,
        mode: true,
        channelId: true,
        messageId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    })

    return {
      success: true,
      panels: panels.map((panel) => ({
        ...panel,
        itemsCount: panel._count.items,
        _count: undefined,
      })),
    }
  })

  fastify.get('/:guildId/reaction-roles/panels/:panelId', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId, panelId } = request.params as { guildId: string; panelId: string }
    const panel = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      select: {
        id: true,
        guildId: true,
        name: true,
        enabled: true,
        mode: true,
        channelId: true,
        messageId: true,
        createdAt: true,
        updatedAt: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, roleId: true, label: true, emoji: true, createdAt: true },
        },
      },
    })

    if (!panel || panel.guildId !== guildId) {
      return reply.code(404).send({ error: 'Panel not found' })
    }

    return { success: true, panel }
  })

  fastify.post('/:guildId/reaction-roles/panels', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = reactionRolePanelUpsertSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const data = parsed.data
    const created = await prisma.reactionRolePanel.create({
      data: {
        guildId,
        name: data.name,
        enabled: data.enabled ?? true,
        mode: data.mode ?? 'multiple',
        items: {
          create: data.items.map((item) => ({
            roleId: item.roleId,
            label: item.label ?? null,
            emoji: item.emoji ?? null,
          })),
        },
      },
      select: { id: true },
    })

    return reply.code(201).send({ success: true, panelId: created.id })
  })

  fastify.put('/:guildId/reaction-roles/panels/:panelId', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId, panelId } = request.params as { guildId: string; panelId: string }
    const parsed = reactionRolePanelUpsertSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const existing = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      select: { id: true, guildId: true },
    })
    if (!existing || existing.guildId !== guildId) {
      return reply.code(404).send({ error: 'Panel not found' })
    }

    const data = parsed.data
    await prisma.$transaction(async (tx) => {
      await tx.reactionRoleItem.deleteMany({ where: { panelId } })
      await tx.reactionRolePanel.update({
        where: { id: panelId },
        data: {
          name: data.name,
          enabled: data.enabled ?? true,
          mode: data.mode ?? 'multiple',
          items: {
            create: data.items.map((item) => ({
              roleId: item.roleId,
              label: item.label ?? null,
              emoji: item.emoji ?? null,
            })),
          },
        },
      })
    })

    return { success: true }
  })

  fastify.delete('/:guildId/reaction-roles/panels/:panelId', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId, panelId } = request.params as { guildId: string; panelId: string }
    const existing = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      select: { id: true, guildId: true },
    })
    if (!existing || existing.guildId !== guildId) {
      return reply.code(404).send({ error: 'Panel not found' })
    }

    await prisma.reactionRolePanel.delete({ where: { id: panelId } })
    return { success: true }
  })

  fastify.post('/:guildId/reaction-roles/panels/:panelId/publish', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId, panelId } = request.params as { guildId: string; panelId: string }
    const parsed = reactionRolePanelPublishSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const existing = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      select: { id: true, guildId: true },
    })
    if (!existing || existing.guildId !== guildId) {
      return reply.code(404).send({ error: 'Panel not found' })
    }

    try {
      const result = await publish_reaction_role_panel(
        {
          guildId,
          panelId,
          channelId: parsed.data.channelId,
          moderatorId: request.user.userId,
        },
        request.log
      )
      return reply.send({ success: true, messageId: result.messageId })
    } catch (error: unknown) {
      request.log.error(
        { err: safe_error_details(error) },
        'Failed to publish reaction role panel via bot internal API'
      )
      return reply.code(502).send({
        error: public_error_message(fastify, 'Failed to publish reaction role panel', 'Bad gateway'),
      })
    }
  })

  fastify.get('/:guildId/starboard-config', {
    preHandler: admin,
  }, async (request) => {
    const { guildId } = request.params as { guildId: string }
    const config = await prisma.starboardConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        channelId: true,
        emoji: true,
        threshold: true,
        ignoreBots: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: config?.enabled ?? false,
        channelId: config?.channelId ?? null,
        emoji: config?.emoji ?? '⭐',
        threshold: typeof config?.threshold === 'number' ? config.threshold : 3,
        ignoreBots: config?.ignoreBots ?? true,
      },
    }
  })

  fastify.put('/:guildId/starboard-config', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const parsed = starboardConfigSchema.safeParse(request.body)

    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const data = parsed.data
    const updated = await prisma.starboardConfig.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.channelId !== undefined ? { channelId: data.channelId ?? null } : {}),
        ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
        ...(data.threshold !== undefined ? { threshold: data.threshold } : {}),
        ...(data.ignoreBots !== undefined ? { ignoreBots: data.ignoreBots } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        channelId: data.channelId ?? null,
        emoji: data.emoji ?? '⭐',
        threshold: data.threshold ?? 3,
        ignoreBots: data.ignoreBots ?? true,
      },
      select: {
        enabled: true,
        channelId: true,
        emoji: true,
        threshold: true,
        ignoreBots: true,
      },
    })

    return {
      success: true,
      config: {
        enabled: updated.enabled,
        channelId: updated.channelId,
        emoji: updated.emoji,
        threshold: updated.threshold,
        ignoreBots: updated.ignoreBots,
      },
    }
  })

  fastify.get('/:guildId/starboard/posts', {
    preHandler: admin,
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const query = request.query as { limit?: string; cursor?: string }
    const limit_raw = query.limit ? Number(query.limit) : 25
    const limit = Number.isFinite(limit_raw) ? Math.min(Math.max(1, limit_raw), 100) : 25
    const cursor =
      typeof query.cursor === 'string' && query.cursor.trim().length > 0
        ? query.cursor.trim()
        : undefined

    try {
      const items = await prisma.starboardPost.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          sourceChannelId: true,
          sourceMessageId: true,
          starboardChannelId: true,
          starboardMessageId: true,
          authorId: true,
          starCount: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      const nextCursor = items.length === limit ? items[items.length - 1]?.id : null
      return { success: true, posts: items, nextCursor }
    } catch (error: unknown) {
      request.log.error({ err: safe_error_details(error) }, 'Failed to list starboard posts')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}
