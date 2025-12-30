import type { FastifyInstance } from 'fastify';
import { prisma } from '@yuebot/database';
import { globalXpResetSchema } from '@yuebot/shared';
import { CONFIG } from '../config';
import { is_owner } from '../utils/permissions';
import { validation_error_details } from '../utils/validation_error';

export default async function xpRoutes(fastify: FastifyInstance) {
  fastify.get('/global-me', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user = request.user;

    const member = await prisma.globalXpMember.findUnique({
      where: { userId: user.userId },
    });

    if (!member) {
      return { xp: 0, level: 0, position: null };
    }

    const above = await prisma.globalXpMember.count({
      where: {
        xp: { gt: member.xp },
      },
    });

    return { xp: member.xp, level: member.level, position: above + 1 };
  });

  fastify.get('/global-leaderboard', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { limit = 25, offset = 0 } = request.query as { limit?: number; offset?: number };

    const rows = await prisma.globalXpMember.findMany({
      orderBy: [{ xp: 'desc' }, { updatedAt: 'asc' }],
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.globalXpMember.count();

    const leaderboard = rows.map((row, index) => ({
      userId: row.userId,
      username: row.username,
      avatar: row.avatar ?? null,
      xp: row.xp,
      level: row.level,
      position: Number(offset) + index + 1,
    }));

    return { leaderboard, total };
  });

  // Zerar XP global (apenas allowlist)
  fastify.post('/global-reset', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;

    const isOwner = is_owner(user.userId)
    const allowlist = CONFIG.admin.globalXpResetUserIds;
    if (!isOwner && (allowlist.length === 0 || !allowlist.includes(user.userId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const parsed = globalXpResetSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error);
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' });
    }

    const { scope, userId } = parsed.data;
    if (scope === 'user' && !userId) {
      return reply.code(400).send({ error: 'userId is required for scope=user' });
    }

    const result = await prisma.globalXpMember.deleteMany({
      where: {
        ...(scope === 'user' ? { userId } : {}),
      },
    });

    return { success: true, deleted: result.count, scope };
  });
}
