import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import { Prisma } from '@yuebot/database'
import { badgeUpsertSchema, userBadgeGrantSchema, userBadgeRevokeSchema } from '@yuebot/shared'
import { validation_error_details } from '../utils/validation_error'

function require_badge_admin(fastify: FastifyInstance, user_id: string): boolean {
  const allowlist = fastify.config?.admin?.badgeAdminUserIds as string[] | undefined
  if (!allowlist || !allowlist.includes(user_id)) return false
  return true
}

function get_badge_admin_forbidden_error(fastify: FastifyInstance, viewer_is_owner: boolean) {
  const allowlist = fastify.config?.admin?.badgeAdminUserIds as string[] | undefined
  if (viewer_is_owner && (!allowlist || allowlist.length === 0)) {
    return { error: 'Forbidden', details: 'Badge admin is not configured. Set BADGE_ADMIN_USER_IDS in the API environment.' }
  }
  return { error: 'Forbidden' }
}

export async function badgesRoutes(fastify: FastifyInstance) {
  fastify.get('/badges', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const viewer_is_admin = require_badge_admin(fastify, request.user.userId)

    const badges = await prisma.badge.findMany({
      where: viewer_is_admin ? {} : { hidden: false },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return { badges }
  })

  fastify.get('/badges/:badgeId/holders', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!require_badge_admin(fastify, request.user.userId)) {
      return reply.code(403).send(get_badge_admin_forbidden_error(fastify, request.user.isOwner))
    }

    const { badgeId } = request.params as { badgeId: string }
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number }

    const badge = await prisma.badge.findUnique({ where: { id: badgeId } })
    if (!badge) return reply.code(404).send({ error: 'Badge not found' })

    const rows = await prisma.userBadge.findMany({
      where: {
        badgeId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ grantedAt: 'desc' }],
      take: Math.min(Number(limit), 200),
      skip: Number(offset),
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    })

    const total = await prisma.userBadge.count({
      where: {
        badgeId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })

    return reply.send({ badge, holders: rows, total })
  })

  fastify.put('/badges', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!require_badge_admin(fastify, request.user.userId)) {
      return reply.code(403).send(get_badge_admin_forbidden_error(fastify, request.user.isOwner))
    }

    const parsed = badgeUpsertSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data

    const badge = await prisma.badge.upsert({
      where: { id: input.id },
      update: {
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        icon: input.icon ?? null,
        hidden: input.hidden ?? false,
      },
      create: {
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        icon: input.icon ?? null,
        hidden: input.hidden ?? false,
      },
    })

    return reply.send({ badge })
  })

  fastify.post('/badges/grant', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!require_badge_admin(fastify, request.user.userId)) {
      return reply.code(403).send(get_badge_admin_forbidden_error(fastify, request.user.isOwner))
    }

    const parsed = userBadgeGrantSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data

    const metadata =
      input.metadata === undefined
        ? undefined
        : input.metadata === null
          ? Prisma.JsonNull
          : (input.metadata as Prisma.InputJsonValue)

    const badge = await prisma.badge.findUnique({ where: { id: input.badgeId } })
    if (!badge) return reply.code(404).send({ error: 'Badge not found' })

    await prisma.user.upsert({
      where: { id: input.userId },
      update: {},
      create: { id: input.userId },
    })

    const user_badge = await prisma.userBadge.upsert({
      where: {
        userId_badgeId: {
          userId: input.userId,
          badgeId: input.badgeId,
        },
      },
      update: {
        source: input.source,
        expiresAt: input.expiresAt ?? null,
        ...(metadata === undefined ? {} : { metadata }),
      },
      create: {
        userId: input.userId,
        badgeId: input.badgeId,
        source: input.source,
        expiresAt: input.expiresAt ?? null,
        ...(metadata === undefined ? {} : { metadata }),
      },
      include: { badge: true },
    })

    return reply.send({ userBadge: user_badge })
  })

  fastify.post('/badges/revoke', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!require_badge_admin(fastify, request.user.userId)) {
      return reply.code(403).send(get_badge_admin_forbidden_error(fastify, request.user.isOwner))
    }

    const parsed = userBadgeRevokeSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const input = parsed.data

    await prisma.userBadge.delete({
      where: {
        userId_badgeId: {
          userId: input.userId,
          badgeId: input.badgeId,
        },
      },
    }).catch((err: unknown) => {
      const prisma_error = err as { code?: unknown }
      if (prisma_error.code === 'P2025') return null
      throw err
    })

    return reply.send({ success: true })
  })
}
