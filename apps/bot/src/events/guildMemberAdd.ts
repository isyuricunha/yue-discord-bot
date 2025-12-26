import type { GuildMember } from 'discord.js'
import { autoroleService } from '../services/autorole.service'
import { welcomeService } from '../services/welcome.service'
import { logger } from '../utils/logger'

export async function handleGuildMemberAdd(member: GuildMember) {
  try {
    await autoroleService.handle_member_add(member)
  } catch (error) {
    logger.error({ error }, 'Erro ao processar autorole (guildMemberAdd)')
  }

  try {
    await welcomeService.handle_member_add(member)
  } catch (error) {
    logger.error({ error }, 'Erro ao processar mensagem de boas-vindas (guildMemberAdd)')
  }
}
