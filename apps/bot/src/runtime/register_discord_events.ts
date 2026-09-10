import { Events, type Client } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { handleGuildMemberUpdate } from '../events/guildMemberUpdate'
import { handleAutoModerationActionExecution } from '../events/autoModerationActionExecution'
import { handleVoiceStateUpdate } from '../events/voiceStateUpdate'
import { update_user_member_snapshots } from '../services/guildMemberSnapshot.service'
import { safe_event, safe_interaction_event } from './safe_event_handler'

export function register_discord_events(client: Client): void {
  client.on('guildCreate', async (guild) => {
    logger.info(`➕ Bot adicionado ao servidor: ${guild.name} (${guild.id})`)

    try {
      const settings = await prisma.botSettings.findUnique({
        where: { id: 'global' },
        select: { blockedGuildIds: true },
      })

      const blocked = Array.isArray(settings?.blockedGuildIds)
        ? (settings.blockedGuildIds as unknown[]).filter((value): value is string => typeof value === 'string')
        : []

      if (blocked.includes(guild.id)) {
        logger.warn(`🚫 Guild bloqueada (owner): saindo de ${guild.name} (${guild.id})`)
        await guild.leave().catch(() => null)
        return
      }

      await prisma.guild.upsert({
        where: { id: guild.id },
        update: {
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
        },
        create: {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
        },
      })

      logger.info(`✅ Servidor ${guild.name} registrado no banco de dados`)
    } catch (error) {
      logger.error({ error }, `❌ Erro ao registrar servidor ${guild.name}`)
    }
  })

  client.on('guildDelete', async (guild) => {
    logger.info(`➖ Bot removido do servidor: ${guild.name} (${guild.id})`)

    try {
      await prisma.guild.deleteMany({ where: { id: guild.id } })
      logger.info(`✅ Servidor removido do banco de dados: ${guild.name} (${guild.id})`)
    } catch (error) {
      logger.error(
        { error, guildId: guild.id },
        '❌ Erro ao remover servidor do banco de dados'
      )
    }
  })

  client.on('interactionCreate', (interaction) => {
    void safe_interaction_event('interactionCreate', interaction, async () => {
      const { handleInteractionCreate } = await import('../events/interactionCreate')
      await handleInteractionCreate(interaction)
    })
  })

  client.on('messageCreate', (message) => {
    void safe_event('messageCreate', async () => {
      const { handleMessageCreate } = await import('../events/messageCreate')
      await handleMessageCreate(message)
    })
  })

  client.on('guildMemberAdd', (member) => {
    void safe_event('guildMemberAdd', async () => {
      const { handleGuildMemberAdd } = await import('../events/guildMemberAdd')
      await handleGuildMemberAdd(member)
    })
  })

  client.on('guildMemberRemove', (member) => {
    void safe_event('guildMemberRemove', async () => {
      const { handleGuildMemberRemove } = await import('../events/guildMemberRemove')
      await handleGuildMemberRemove(member.guild, member.user)
    })
  })

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    void safe_event('voiceStateUpdate', async () => {
      await handleVoiceStateUpdate(oldState, newState)
    })
  })

  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    void safe_event('guildMemberUpdate', async () => {
      await handleGuildMemberUpdate(oldMember, newMember)
    })
  })

  client.on(Events.UserUpdate, async (_oldUser, newUser) => {
    try {
      await update_user_member_snapshots(newUser)
    } catch (error) {
      logger.error({ error, userId: newUser.id }, 'Erro ao atualizar snapshots do usuário')
    }
  })

  client.on(Events.AutoModerationActionExecution, (execution) => {
    void safe_event('autoModerationActionExecution', async () => {
      await handleAutoModerationActionExecution(execution)
    })
  })

  client.on('guildMemberUpdate', (old_member, new_member) => {
    void safe_event('guildMemberAuditUpdate', async () => {
      const { handleAuditGuildMemberUpdate } = await import('../events/auditGuildMemberUpdate')
      await handleAuditGuildMemberUpdate(old_member, new_member)
    })
  })

  client.on('messageDelete', (message) => {
    void safe_event('messageDelete', async () => {
      const { handleMessageDelete } = await import('../events/messageDelete')
      await handleMessageDelete(message)
    })
  })

  client.on('messageUpdate', (old_message, new_message) => {
    void safe_event('messageUpdate', async () => {
      const { handleMessageUpdate } = await import('../events/messageUpdate')
      await handleMessageUpdate(old_message, new_message)
    })
  })

  client.on('channelCreate', (channel) => {
    if (!('guild' in channel)) return
    void safe_event('channelCreate', async () => {
      const { handleChannelCreate } = await import('../events/channelCreate')
      await handleChannelCreate(channel as any)
    })
  })

  client.on('channelUpdate', (old_channel, new_channel) => {
    if (!('guild' in new_channel)) return
    void safe_event('channelUpdate', async () => {
      const { handleChannelUpdate } = await import('../events/channelUpdate')
      await handleChannelUpdate(old_channel as any, new_channel as any)
    })
  })

  client.on('channelDelete', (channel) => {
    if (!('guild' in channel)) return
    void safe_event('channelDelete', async () => {
      const { handleChannelDelete } = await import('../events/channelDelete')
      await handleChannelDelete(channel as any)
    })
  })

  client.on('messageReactionAdd', (reaction, user) => {
    void safe_event('messageReactionAdd', async () => {
      const { execute } = await import('../events/messageReactionAdd')
      await execute(reaction, user)
    })
  })

  client.on('messageReactionRemove', (reaction, user) => {
    void safe_event('messageReactionRemove', async () => {
      const { execute } = await import('../events/messageReactionRemove')
      await execute(reaction, user)
    })
  })

  client.on('error', (error) => {
    logger.error({ error }, '❌ Erro no cliente Discord')
  })
}
