import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

export async function execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
  if (user.bot) return

  if (reaction.partial) {
    try {
      await reaction.fetch()
    } catch (error) {
      return
    }
  }

  if (reaction.emoji.name === '🎉') {
    const message = reaction.message
    if (!message.guild) return

    const giveaway = await prisma.giveaway.findFirst({
      where: {
        messageId: message.id,
        ended: false,
      },
    })

    if (!giveaway) return

    if (giveaway.format !== 'reaction') return

    // Remover entrada
    await prisma.giveawayEntry.deleteMany({
      where: {
        giveawayId: giveaway.id,
        userId: user.id,
      },
    })

    // Atualizar embed
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
    await reactionRoleService.handle_reaction_remove(reaction, user)
  } catch (error: unknown) {
    logger.warn({ err: safe_error_details(error) }, 'reaction roles: failed to handle reaction remove')
  }

  try {
    const { starboardService } = await import('../services/starboard.service')
    await starboardService.handle_reaction_update(reaction, user)
  } catch (error: unknown) {
    logger.warn({ err: safe_error_details(error) }, 'starboard: failed to handle reaction remove')
  }
}
