import type { GuildMember } from 'discord.js'
import { autoroleService } from '../services/autorole.service'
import { getModerationPersistenceService } from '../services/moderationPersistence.service'
import { getPunishmentRoleService } from '../services/punishmentRole.service'
import { welcomeService } from '../services/welcome.service'
import { antiRaidService } from '../services/antiRaid.service'
import { afkService } from '../services/afk.service'
import { supportService } from '../services/support/support.service'
import { upsert_guild_member_snapshot } from '../services/guildMemberSnapshot.service'
import { logger } from '../utils/logger'

export async function handleGuildMemberAdd(member: GuildMember) {
  // Security gate first: during an active raid this also applies the configured action
  // to the new member and avoids doing welcome/autorole/support work for the hostile join.
  try {
    const blocked_by_antiraid = await antiRaidService.trackJoin(member.guild.id, member)
    if (blocked_by_antiraid) return
  } catch (error) {
    logger.error({ error }, 'Erro ao processar anti-raid (guildMemberAdd)')
  }

  try {
    await upsert_guild_member_snapshot(member)
  } catch (error) {
    logger.error({ error }, 'Erro ao sincronizar snapshot do membro (guildMemberAdd)')
  }

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
    await supportService.restore_member_entitlements(member)
  } catch (error) {
    logger.error({ error }, 'Erro ao restaurar apoios ativos (guildMemberAdd)')
  }

  try {
    await welcomeService.handle_member_add(member)
  } catch (error) {
    logger.error({ error }, 'Erro ao processar mensagem de boas-vindas (guildMemberAdd)')
  }

}
