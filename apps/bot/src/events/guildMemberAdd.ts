import type { GuildMember } from 'discord.js'
import { autoroleService } from '../services/autorole.service'
import { getModerationPersistenceService } from '../services/moderationPersistence.service'
import { welcomeService } from '../services/welcome.service'
import { logger } from '../utils/logger'

export async function handleGuildMemberAdd(member: GuildMember) {
  try {
    const service = getModerationPersistenceService()
    await service?.handle_member_add(member)
  } catch (error) {
    logger.error({ error }, 'Erro ao processar reapply de timeout (guildMemberAdd)')
  }

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
