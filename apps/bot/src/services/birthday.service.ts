import { prisma } from '@yuebot/database';

export type user_birthday = {
  id: string;
  userId: string;
  day: number;
  month: number;
  year: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Validate birthday date
 */
export function isValidBirthday(day: number, month: number, year?: number): boolean {
  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;
  
  // Check for valid day in month
  const daysInMonth = new Date(year || 2024, month, 0).getDate();
  if (day > daysInMonth) return false;
  
  // Year validation (reasonable range)
  if (year !== undefined) {
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) return false;
  }
  
  return true;
}

/**
 * Format birthday as string (day/month)
 */
export function formatBirthdayDayMonth(day: number, month: number): string {
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return `${day} de ${monthNames[month - 1]}`;
}

/**
 * Calculate age from birthday
 */
export function calculateAge(year: number | null): number | null {
  if (!year) return null;
  const currentYear = new Date().getFullYear();
  return currentYear - year;
}

/**
 * Set or update user birthday
 */
export async function setBirthday(
  userId: string,
  day: number,
  month: number,
  year?: number
): Promise<user_birthday> {
  if (!isValidBirthday(day, month, year)) {
    throw new Error('Data de aniversário inválida');
  }

  const birthday = await prisma.userBirthday.upsert({
    where: {
      userId,
    },
    update: {
      day,
      month,
      year: year || null,
    },
    create: {
      userId,
      day,
      month,
      year: year || null,
    },
  });

  return birthday;
}

/**
 * Get user birthday
 */
export async function getBirthday(userId: string): Promise<user_birthday | null> {
  return prisma.userBirthday.findUnique({
    where: {
      userId,
    },
  });
}

/**
 * Delete user birthday
 */
export async function deleteBirthday(userId: string): Promise<void> {
  await prisma.userBirthday.delete({
    where: {
      userId,
    },
  }).catch(() => {
    // Ignore if not found
  });
}

/**
 * Get birthdays by day and month (for finding today's birthdays)
 */
export async function getBirthdaysByDate(day: number, month: number): Promise<user_birthday[]> {
  return prisma.userBirthday.findMany({
    where: {
      day,
      month,
    },
  });
}

/**
 * Get upcoming birthdays in the next N days for a guild
 */
export async function getUpcomingBirthdays(
  guildId: string,
  daysAhead: number = 30
): Promise<{ birthday: user_birthday; userId: string; username: string; avatar: string | null }[]> {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  
  // Get all birthdays
  const allBirthdays = await prisma.userBirthday.findMany({
    select: {
      id: true,
      userId: true,
      day: true,
      month: true,
      year: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  // Get guild members
  const guildMembers = await prisma.guildMember.findMany({
    where: {
      guildId,
    },
    select: {
      userId: true,
      username: true,
      avatar: true,
    },
  });
  
  // Create a map of userId to member
  const memberMap = new Map<string, { username: string; avatar: string | null }>();
  guildMembers.forEach(member => {
    memberMap.set(member.userId, { username: member.username, avatar: member.avatar });
  });
  
  // Filter birthdays that are in guild and upcoming
  const upcoming: { birthday: user_birthday; userId: string; username: string; avatar: string | null }[] = [];
  
  for (const birthday of allBirthdays) {
    const member = memberMap.get(birthday.userId);
    if (!member) continue;
    
    // Calculate days until birthday
    let birthdayMonth = birthday.month;
    let birthdayDay = birthday.day;
    
    // If birthday has passed this year, it's next year
    let isPast = false;
    if (birthdayMonth < currentMonth || (birthdayMonth === currentMonth && birthdayDay < currentDay)) {
      isPast = true;
    }
    
    // Calculate days until birthday
    let daysUntil: number;
    if (isPast) {
      // Birthday passed, calculate days until next year
      const now2 = new Date(now.getFullYear() + 1, birthdayMonth - 1, birthdayDay);
      daysUntil = Math.ceil((now2.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      const birthdayDate = new Date(now.getFullYear(), birthdayMonth - 1, birthdayDay);
      daysUntil = Math.ceil((birthdayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    if (daysUntil <= daysAhead) {
      upcoming.push({
        birthday,
        userId: birthday.userId,
        username: member.username,
        avatar: member.avatar,
      });
    }
  }
  
  // Sort by days until birthday
  upcoming.sort((a, b) => {
    const aDays = getDaysUntil(new Date().getFullYear(), a.birthday.month, a.birthday.day);
    const bDays = getDaysUntil(new Date().getFullYear(), b.birthday.month, b.birthday.day);
    return aDays - bDays;
  });
  
  return upcoming;
}

function getDaysUntil(year: number, month: number, day: number): number {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  
  if (month < currentMonth || (month === currentMonth && day < currentDay)) {
    // Birthday passed this year
    const nextBirthday = new Date(year + 1, month - 1, day);
    return Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    const birthdayDate = new Date(year, month - 1, day);
    return Math.ceil((birthdayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
}

/**
 * Get guild birthday configuration
 */
export async function getBirthdayConfig(guildId: string): Promise<{
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;
} | null> {
  const config = await prisma.guildConfig.findUnique({
    where: {
      guildId,
    },
    select: {
      birthdayEnabled: true,
      birthdayChannelId: true,
      birthdayRoleId: true,
    },
  });
  
  if (!config) return null;
  
  return {
    enabled: config.birthdayEnabled ?? true,
    channelId: config.birthdayChannelId,
    roleId: config.birthdayRoleId,
  };
}

/**
 * Update guild birthday configuration
 */
export async function updateBirthdayConfig(
  guildId: string,
  data: {
    enabled?: boolean;
    channelId?: string | null;
    roleId?: string | null;
  }
): Promise<void> {
  await prisma.guildConfig.upsert({
    where: {
      guildId,
    },
    update: {
      birthdayEnabled: data.enabled,
      birthdayChannelId: data.channelId,
      birthdayRoleId: data.roleId,
    },
    create: {
      guildId,
      birthdayEnabled: data.enabled ?? true,
      birthdayChannelId: data.channelId,
      birthdayRoleId: data.roleId,
    },
  });
}

export const birthdayService = {
  isValidBirthday,
  formatBirthdayDayMonth,
  calculateAge,
  setBirthday,
  getBirthday,
  deleteBirthday,
  getBirthdaysByDate,
  getUpcomingBirthdays,
  getBirthdayConfig,
  updateBirthdayConfig,
};
