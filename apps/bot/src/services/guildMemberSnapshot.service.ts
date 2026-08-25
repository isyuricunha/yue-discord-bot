import type { GuildMember, User } from 'discord.js'
import { prisma } from '@yuebot/database'

export async function upsert_guild_member_snapshot(member: GuildMember) {
  return prisma.guildMember.upsert({
    where: {
      userId_guildId: {
        userId: member.id,
        guildId: member.guild.id,
      },
    },
    update: {
      username: member.user.username,
      avatar: member.user.avatar,
      ...(member.joinedAt ? { joinedAt: member.joinedAt } : {}),
    },
    create: {
      userId: member.id,
      guildId: member.guild.id,
      username: member.user.username,
      avatar: member.user.avatar,
      joinedAt: member.joinedAt ?? new Date(),
    },
  })
}

export async function update_user_member_snapshots(user: User) {
  return prisma.guildMember.updateMany({
    where: { userId: user.id },
    data: {
      username: user.username,
      avatar: user.avatar,
    },
  })
}
