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
 * Get upcoming birthdays in the next N days for a guild
 */
export async function getUpcomingBirthdays(
  guildId: string,
  daysAhead: number = 30
): Promise<{ birthday: user_birthday; userId: string; username: string; avatar: string | null }[]> {
  const now = new Date()
  const safe_days_ahead = Math.max(0, Math.min(366, Math.floor(daysAhead)))
  const day_month_pairs = new Map<string, { day: number; month: number; offset: number }>()

  for (let offset = 0; offset <= safe_days_ahead; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12)
    const day = date.getDate()
    const month = date.getMonth() + 1
    const key = `${month}:${day}`
    if (!day_month_pairs.has(key)) {
      day_month_pairs.set(key, { day, month, offset })
    }

    // Preserve the previous JavaScript Date behavior for Feb 29 birthdays:
    // in non-leap years, new Date(year, 1, 29) normalizes to March 1.
    if (month === 3 && day === 1) {
      const feb_last_day = new Date(date.getFullYear(), 2, 0).getDate()
      if (feb_last_day === 28 && !day_month_pairs.has('2:29')) {
        day_month_pairs.set('2:29', { day: 29, month: 2, offset })
      }
    }
  }

  const birthdays = await prisma.userBirthday.findMany({
    where: {
      OR: Array.from(day_month_pairs.values()).map(({ day, month }) => ({ day, month })),
    },
    select: {
      id: true,
      userId: true,
      day: true,
      month: true,
      year: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (birthdays.length === 0) return []

  const user_ids = birthdays.map((birthday) => birthday.userId)
  const guild_members = await prisma.guildMember.findMany({
    where: {
      guildId,
      userId: { in: user_ids },
    },
    select: {
      userId: true,
      username: true,
      avatar: true,
    },
  })

  const member_by_id = new Map(
    guild_members.map((member) => [member.userId, { username: member.username, avatar: member.avatar }])
  )

  return birthdays
    .flatMap((birthday) => {
      const member = member_by_id.get(birthday.userId)
      if (!member) return []

      const offset = day_month_pairs.get(`${birthday.month}:${birthday.day}`)?.offset
      if (offset === undefined || offset > safe_days_ahead) return []

      return [{
        birthday,
        userId: birthday.userId,
        username: member.username,
        avatar: member.avatar,
        offset,
      }]
    })
    .sort((a, b) => a.offset - b.offset)
    .map(({ offset: _offset, ...item }) => item)
}
