import type { Guild, User } from 'discord.js'

import { welcomeService } from '../services/welcome.service'
import { logger } from '../utils/logger'

export async function handleGuildMemberRemove(guild: Guild, user: User) {
  try {
    await welcomeService.handle_member_remove(guild, {
      id: user.id,
      username: user.username,
      tag: user.tag,
      avatarUrl: user.displayAvatarURL(),
    })
  } catch (error) {
    logger.error({ error }, 'Erro ao processar mensagem de saída (guildMemberRemove)')
  }
}
