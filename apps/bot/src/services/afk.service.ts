import { prisma } from '@yuebot/database';

export type user_afk = {
  id: string;
  userId: string;
  guildId: string;
  reason: string | null;
  startedAt: Date;
  isAfk: boolean;
};

type AfkDb = {
  userAfk: Pick<typeof prisma.userAfk, 'upsert' | 'findUnique' | 'findMany' | 'delete'>;
};

export function findFirstActiveAfk(userIds: string[], afks: user_afk[]): user_afk | null {
  const afkByUserId = new Map(
    afks
      .filter((afk) => afk.isAfk)
      .map((afk) => [afk.userId, afk] as const)
  );

  for (const userId of userIds) {
    const afk = afkByUserId.get(userId);
    if (afk) return afk;
  }

  return null;
}

export class AfkService {
  constructor(private readonly db: AfkDb = prisma) {}

  async setAfk(userId: string, guildId: string, reason: string | null): Promise<user_afk> {
    return this.db.userAfk.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      update: {
        reason,
        startedAt: new Date(),
        isAfk: true,
      },
      create: {
        userId,
        guildId,
        reason,
        isAfk: true,
      },
    });
  }

  async removeAfk(userId: string, guildId: string): Promise<user_afk | null> {
    const afk = await this.db.userAfk.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!afk) {
      return null;
    }

    await this.db.userAfk.delete({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    return afk;
  }

  async getAfk(userId: string, guildId: string): Promise<user_afk | null> {
    return this.db.userAfk.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });
  }

  async getAfks(userIds: string[], guildId: string): Promise<user_afk[]> {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) return [];

    return this.db.userAfk.findMany({
      where: {
        guildId,
        userId: { in: uniqueUserIds },
      },
    });
  }
}

export const afkService = new AfkService();

export function setAfk(userId: string, guildId: string, reason: string | null): Promise<user_afk> {
  return afkService.setAfk(userId, guildId, reason);
}

export function removeAfk(userId: string, guildId: string): Promise<user_afk | null> {
  return afkService.removeAfk(userId, guildId);
}

export function getAfk(userId: string, guildId: string): Promise<user_afk | null> {
  return afkService.getAfk(userId, guildId);
}

export function getAfks(userIds: string[], guildId: string): Promise<user_afk[]> {
  return afkService.getAfks(userIds, guildId);
}
