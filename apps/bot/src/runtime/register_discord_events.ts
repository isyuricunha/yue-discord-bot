import { Events, type Client } from 'discord.js'
import { prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { handleGuildMemberUpdate } from '../events/guildMemberUpdate'
import { handleAutoModerationActionExecution } from '../events/autoModerationActionExecution'
import { handleVoiceStateUpdate } from '../events/voiceStateUpdate'

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

  client.on('interactionCreate', async (interaction) => {
    const { handleInteractionCreate } = await import('../events/interactionCreate')
    await handleInteractionCreate(interaction)
  })

  client.on('messageCreate', async (message) => {
    const { handleMessageCreate } = await import('../events/messageCreate')
    await handleMessageCreate(message)
  })

  client.on('guildMemberAdd', async (member) => {
    const { handleGuildMemberAdd } = await import('../events/guildMemberAdd')
    await handleGuildMemberAdd(member)
  })

  client.on('guildMemberRemove', async (member) => {
    const { handleGuildMemberRemove } = await import('../events/guildMemberRemove')
    await handleGuildMemberRemove(member.guild, member.user)
  })

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    await handleVoiceStateUpdate(oldState, newState)
  })

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    await handleGuildMemberUpdate(oldMember, newMember)
  })

  client.on(Events.AutoModerationActionExecution, async (execution) => {
    await handleAutoModerationActionExecution(execution)
  })

  client.on('guildMemberUpdate', async (old_member, new_member) => {
    const { handleAuditGuildMemberUpdate } = await import('../events/auditGuildMemberUpdate')
    await handleAuditGuildMemberUpdate(old_member, new_member)
  })

  client.on('messageDelete', async (message) => {
    const { handleMessageDelete } = await import('../events/messageDelete')
    await handleMessageDelete(message)
  })

  client.on('messageUpdate', async (old_message, new_message) => {
    const { handleMessageUpdate } = await import('../events/messageUpdate')
    await handleMessageUpdate(old_message, new_message)
  })

  client.on('channelCreate', async (channel) => {
    if (!('guild' in channel)) return
    const { handleChannelCreate } = await import('../events/channelCreate')
    await handleChannelCreate(channel as any)
  })

  client.on('channelUpdate', async (old_channel, new_channel) => {
    if (!('guild' in new_channel)) return
    const { handleChannelUpdate } = await import('../events/channelUpdate')
    await handleChannelUpdate(old_channel as any, new_channel as any)
  })

  client.on('channelDelete', async (channel) => {
    if (!('guild' in channel)) return
    const { handleChannelDelete } = await import('../events/channelDelete')
    await handleChannelDelete(channel as any)
  })

  client.on('messageReactionAdd', async (reaction, user) => {
    const { execute } = await import('../events/messageReactionAdd')
    await execute(reaction, user)
  })

  client.on('messageReactionRemove', async (reaction, user) => {
    const { execute } = await import('../events/messageReactionRemove')
    await execute(reaction, user)
  })

  client.on('error', (error) => {
    logger.error({ error }, '❌ Erro no cliente Discord')
  })
}
