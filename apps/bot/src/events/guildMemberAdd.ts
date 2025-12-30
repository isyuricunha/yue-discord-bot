import type { GuildMember } from 'discord.js'
import { autoroleService } from '../services/autorole.service'
import { getModerationPersistenceService } from '../services/moderationPersistence.service'
import { getPunishmentRoleService } from '../services/punishmentRole.service'
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
    const service = getPunishmentRoleService()
    await service?.sync_member(member, '[Auto] Sync cargo de punição (membro entrou)')
  } catch (error) {
    logger.error({ error }, 'Erro ao processar sync do cargo de punição (guildMemberAdd)')
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
