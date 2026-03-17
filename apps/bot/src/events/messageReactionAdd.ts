import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

function is_expected_reaction_fetch_error(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const any_error = error as { status?: unknown; code?: unknown; message?: unknown; name?: unknown }
  const status = typeof any_error.status === 'number' ? any_error.status : null
  const code = typeof any_error.code === 'number' ? any_error.code : null
  const name = typeof any_error.name === 'string' ? any_error.name : ''
  const message = typeof any_error.message === 'string' ? any_error.message : ''

  // DiscordAPIError[50001]: Missing Access (commonly when bot lost permission or channel/message is no longer accessible)
  if (status === 403 && (code === 50001 || name.includes('50001') || message.toLowerCase().includes('missing access'))) {
    return true
  }

  // DiscordAPIError[10008]: Unknown Message (reaction partial fetch can fail if message was deleted)
  if (status === 404 && (code === 10008 || name.includes('10008') || message.toLowerCase().includes('unknown message'))) {
    return true
  }

  return false
}

export async function execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
  // Ignorar bots
  if (user.bot) return

  // Fetch parciais
  if (reaction.partial) {
    try {
      await reaction.fetch()
    } catch (error) {
      if (is_expected_reaction_fetch_error(error)) return
      logger.warn({ err: safe_error_details(error) }, 'Erro ao buscar reaction')
      return
    }
  }

  if (user.partial) {
    try {
      await user.fetch()
    } catch (error) {
      if (is_expected_reaction_fetch_error(error)) return
      logger.warn({ err: safe_error_details(error) }, 'Erro ao buscar user')
      return
    }
  }

  // Verificar se é uma reaction de giveaway
  if (reaction.emoji.name === '🎉') {
    const message = reaction.message
    if (!message.guild) return

    // Buscar giveaway
    const giveaway = await prisma.giveaway.findFirst({
      where: {
        messageId: message.id,
        ended: false,
      },
    })

    if (!giveaway) return

    if (giveaway.format !== 'reaction') return

    if (giveaway.cancelled || giveaway.suspended) {
      await reaction.users.remove(user.id).catch(() => null)
      return
    }

    // Verificar se já está participando
    const existing = await prisma.giveawayEntry.findUnique({
      where: {
        giveawayId_userId: {
          giveawayId: giveaway.id,
          userId: user.id,
        },
      },
    })

    if (existing) return

    // Verificar cargo necessário (um ou mais)
    const required_role_ids =
      Array.isArray(giveaway.requiredRoleIds) && giveaway.requiredRoleIds.length > 0
        ? (giveaway.requiredRoleIds as string[])
        : giveaway.requiredRoleId
          ? [giveaway.requiredRoleId]
          : []

    if (required_role_ids.length > 0) {
      try {
        const member = await message.guild.members.fetch(user.id)
        const has_any_required_role = required_role_ids.some((id) => member.roles.cache.has(id))
        if (!has_any_required_role) {
          await reaction.users.remove(user.id)
          return
        }
      } catch (error) {
        logger.warn({ err: safe_error_details(error) }, 'Erro ao verificar cargo')
        return
      }
    }

    // Criar entrada
    await prisma.giveawayEntry.create({
      data: {
        giveawayId: giveaway.id,
        userId: user.id,
        username: (user as User).username,
        avatar: (user as User).avatar,
      },
    })

    // Atualizar embed com contagem
    const entriesCount = await prisma.giveawayEntry.count({
      where: { giveawayId: giveaway.id, disqualified: false },
    })

    const embed = message.embeds[0]
    if (embed) {
      const newEmbed = {
        ...embed.data,
        fields: embed.fields.map(field => {
          if (field.name === '📋 Participantes') {
            return { ...field, value: String(entriesCount) }
          }
          return field
        }),
      }

      await message.edit({ embeds: [newEmbed] })
    }
  }

  try {
    const { reactionRoleService } = await import('../services/reactionRole.service')
    await reactionRoleService.handle_reaction_add(reaction, user)
  } catch (error: unknown) {
    logger.warn({ err: safe_error_details(error) }, 'reaction roles: failed to handle reaction add')
  }

  try {
    const { starboardService } = await import('../services/starboard.service')
    await starboardService.handle_reaction_update(reaction, user)
  } catch (error: unknown) {
    logger.warn({ err: safe_error_details(error) }, 'starboard: failed to handle reaction add')
  }
}
