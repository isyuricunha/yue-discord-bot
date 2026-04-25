/**
 * Gera a URL do avatar do Discord para um usuário.
 * Retorna null se o usuário não tiver avatar.
 */
export function getDiscordAvatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`
}

export interface api_channel {
  id: string
  name: string
  type: number
}

export function channel_label(channel: api_channel) {
  return `#${channel.name}`
}
