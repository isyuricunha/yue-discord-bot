import type { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@yuebot/database'
import { fanArtReviewSchema, fanArtStatusSchema, fanArtSubmitSchema } from '@yuebot/shared'

function require_fanart_reviewer(fastify: FastifyInstance, user_id: string): boolean {
  const allowlist = fastify.config?.admin?.fanArtReviewerUserIds as string[] | undefined
  if (!allowlist || !allowlist.includes(user_id)) return false
  return true
}

function get_fanart_reviewer_forbidden_error(fastify: FastifyInstance) {
  const allowlist = fastify.config?.admin?.fanArtReviewerUserIds as string[] | undefined
  if (!allowlist || allowlist.length === 0) {
    return {
      error: 'Forbidden',
      details: 'Fan art reviewer is not configured. Set FAN_ART_REVIEWER_USER_IDS in the API environment.',
    }
  }
  return { error: 'Forbidden' }
}

export async function fanartsRoutes(fastify: FastifyInstance) {
  fastify.get('/fanarts', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { limit = 30, offset = 0 } = request.query as { limit?: number; offset?: number }

    const rows = await prisma.fanArt.findMany({
      where: { status: 'approved' },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.min(Number(limit), 100),
      skip: Number(offset),
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    })

    const total = await prisma.fanArt.count({ where: { status: 'approved' } })

    return { fanArts: rows, total }
  })

  fastify.post('/fanarts', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const parsed = fanArtSubmitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const input = parsed.data

    await prisma.user.upsert({
      where: { id: request.user.userId },
      update: { username: request.user.username, avatar: request.user.avatar },
      create: { id: request.user.userId, username: request.user.username, avatar: request.user.avatar },
    })

    const tags = input.tags ? (input.tags as Prisma.InputJsonValue) : undefined

    const fan_art = await prisma.fanArt.create({
      data: {
        userId: request.user.userId,
        status: 'pending',
        imageUrl: input.imageUrl,
        imageName: input.imageName ?? null,
        imageSize: input.imageSize ?? null,
        title: input.title ?? null,
        description: input.description ?? null,
        tags: tags === undefined ? undefined : tags,
        sourceChannelId: input.sourceChannelId ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
      },
    })

    return reply.send({ fanArt: fan_art })
  })

  fastify.get('/fanarts/pending', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!require_fanart_reviewer(fastify, request.user.userId)) {
      return reply.code(403).send(get_fanart_reviewer_forbidden_error(fastify))
    }

    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number }

    const rows = await prisma.fanArt.findMany({
      where: { status: 'pending' },
      orderBy: [{ createdAt: 'asc' }],
      take: Math.min(Number(limit), 100),
      skip: Number(offset),
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    })

    const total = await prisma.fanArt.count({ where: { status: 'pending' } })

    return reply.send({ fanArts: rows, total })
  })

  fastify.post('/fanarts/:fanArtId/review', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!require_fanart_reviewer(fastify, request.user.userId)) {
      return reply.code(403).send(get_fanart_reviewer_forbidden_error(fastify))
    }

    const { fanArtId } = request.params as { fanArtId: string }

    const parsed = fanArtReviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
    }

    const input = parsed.data

    // Extra guard: ensure status is one of expected
    const status_ok = fanArtStatusSchema.safeParse(input.status)
    if (!status_ok.success) {
      return reply.code(400).send({ error: 'Invalid status' })
    }

    const existing = await prisma.fanArt.findUnique({ where: { id: fanArtId } })
    if (!existing) return reply.code(404).send({ error: 'Fan art not found' })

    const updated = await prisma.fanArt.update({
      where: { id: fanArtId },
      data: {
        status: input.status,
        reviewedByUserId: request.user.userId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote ?? null,
      },
    })

    return reply.send({ fanArt: updated })
  })
}
