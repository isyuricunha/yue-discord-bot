import type { GuildMember, PartialGuildMember } from 'discord.js'

import { getPunishmentRoleService } from '../services/punishmentRole.service'
import { logger } from '../utils/logger'

export async function handleGuildMemberUpdate(
  _old_member: GuildMember | PartialGuildMember,
  new_member: GuildMember | PartialGuildMember
) {
  try {
    const resolved = new_member.partial ? await new_member.fetch().catch(() => null) : new_member
    if (!resolved) return

    const service = getPunishmentRoleService()
    await service?.sync_member(resolved, '[Auto] Sync cargo de punição (member update)')
  } catch (error) {
    logger.error({ error }, 'Erro ao processar sync do cargo de punição (guildMemberUpdate)')
  }
}
