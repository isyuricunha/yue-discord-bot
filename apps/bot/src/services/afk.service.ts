import { prisma } from '@yuebot/database';

export type user_afk = {
  id: string;
  userId: string;
  guildId: string;
  reason: string | null;
  startedAt: Date;
  isAfk: boolean;
};

export async function setAfk(userId: string, guildId: string, reason: string | null): Promise<user_afk> {
  const afk = await prisma.userAfk.upsert({
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

  return afk;
}

export async function removeAfk(userId: string, guildId: string): Promise<user_afk | null> {
  const afk = await prisma.userAfk.findUnique({
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

  await prisma.userAfk.delete({
    where: {
      userId_guildId: {
        userId,
        guildId,
      },
    },
  });

  return afk;
}

export async function getAfk(userId: string, guildId: string): Promise<user_afk | null> {
  return prisma.userAfk.findUnique({
    where: {
      userId_guildId: {
        userId,
        guildId,
      },
    },
  });
}

export const afkService = {
  setAfk,
  removeAfk,
  getAfk,
};
