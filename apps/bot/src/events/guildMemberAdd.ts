import type { GuildMember } from 'discord.js'
import { autoroleService } from '../services/autorole.service'
import { getModerationPersistenceService } from '../services/moderationPersistence.service'
import { getPunishmentRoleService } from '../services/punishmentRole.service'
import { welcomeService } from '../services/welcome.service'
import { antiRaidService } from '../services/antiRaid.service'
import { afkService } from '../services/afk.service'
import { logger } from '../utils/logger'

export async function handleGuildMemberAdd(member: GuildMember) {
  // Auto-remove AFK when user joins (they're back)
  try {
    const existingAfk = await afkService.getAfk(member.id, member.guild.id);
    if (existingAfk && existingAfk.isAfk) {
      await afkService.removeAfk(member.id, member.guild.id);
      logger.info(
        { userId: member.id, guildId: member.guild.id },
        'AFK removed automatically on guildMemberAdd (user is back)'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Erro ao processar remoção de AFK (guildMemberAdd)')
  }

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

  // Track join for anti-raid detection
  try {
    await antiRaidService.trackJoin(member.guild.id, member)
  } catch (error) {
    logger.error({ error }, 'Erro ao processar anti-raid (guildMemberAdd)')
  }
}
