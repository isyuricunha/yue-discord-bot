import type { FastifyInstance } from 'fastify'
import { prisma } from '@yuebot/database'
import { profileUpdateSchema } from '@yuebot/shared'
import { InternalBotApiError, set_user_profile } from '../internal/bot_internal_api'
import { validation_error_details } from '../utils/validation_error'
import { is_owner } from '../utils/permissions'
import { safe_error_details } from '../utils/safe_error'

function is_badge_admin(fastify: FastifyInstance, user_id: string): boolean {
  if (is_owner(user_id)) return true
  const allowlist = fastify.config?.admin?.badgeAdminUserIds as string[] | undefined
  if (!allowlist) return false
  return allowlist.includes(user_id)
}

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.get('/profile/:userId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        badges: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: { badge: true },
          orderBy: { grantedAt: 'desc' },
        },
      },
    })

    if (!user) return reply.code(404).send({ error: 'User not found' })

    const viewer_is_admin = is_badge_admin(fastify, request.user.userId)

    return reply.send({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        profile: user.profile,
        badges: user.badges
          .filter((ub) => viewer_is_admin || ub.badge.hidden !== true)
          .map((ub) => ({
            badge: ub.badge,
            source: ub.source,
            grantedAt: ub.grantedAt,
            expiresAt: ub.expiresAt,
            metadata: ub.metadata,
          })),
      },
    })
  })

  fastify.get('/profile/me', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user_id = request.user.userId

    const user = await prisma.user.upsert({
      where: { id: user_id },
      update: { username: request.user.username, avatar: request.user.avatar },
      create: { id: user_id, username: request.user.username, avatar: request.user.avatar },
      include: { profile: true },
    })

    return { success: true, user }
  })

  fastify.patch('/profile/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const parsed = profileUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const user_id = request.user.userId
    if (!is_owner(user_id)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const { bio } = parsed.data

    await prisma.user.upsert({
      where: { id: user_id },
      update: { username: request.user.username, avatar: request.user.avatar },
      create: { id: user_id, username: request.user.username, avatar: request.user.avatar },
    })

    const profile = await prisma.userProfile.upsert({
      where: { userId: user_id },
      update: { bio: bio ?? null },
      create: { userId: user_id, bio: bio ?? null },
    })

    let bot_synced = false

    try {
      await set_user_profile({ userId: user_id, bio: profile.bio ?? null }, request.log)
      bot_synced = true
    } catch (error: unknown) {
      if (error instanceof InternalBotApiError) {
        request.log.warn({ status: error.status, body: error.body }, 'Failed to sync profile to bot via internal API')
      } else {
        request.log.warn({ err: safe_error_details(error) }, 'Failed to sync profile to bot via internal API')
      }
    }

    return reply.send({ success: true, profile, botSynced: bot_synced })
  })
}
