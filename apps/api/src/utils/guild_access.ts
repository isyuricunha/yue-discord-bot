type auth_user = {
  guilds?: string[]
  isOwner?: boolean
}

export function can_access_guild(user: auth_user, guild_id: string): boolean {
  if (user.isOwner) return true
  return Boolean(user.guilds?.includes(guild_id))
}
