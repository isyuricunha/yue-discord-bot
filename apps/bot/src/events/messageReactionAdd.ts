import { Events, MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

export const name = Events.MessageReactionAdd
export const once = false

export async function execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
  // Ignorar bots
  if (user.bot) return

  // Fetch parciais
  if (reaction.partial) {
    try {
      await reaction.fetch()
    } catch (error) {
      logger.warn({ err: safe_error_details(error) }, 'Erro ao buscar reaction')
      return
    }
  }

  if (user.partial) {
    try {
      await user.fetch()
    } catch (error) {
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

    // Verificar cargo necessário
    if (giveaway.requiredRoleId) {
      try {
        const member = await message.guild.members.fetch(user.id)
        if (!member.roles.cache.has(giveaway.requiredRoleId)) {
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
