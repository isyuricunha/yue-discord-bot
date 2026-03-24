import { EmbedBuilder, TextChannel } from 'discord.js'
import { prisma, Prisma } from '@yuebot/database'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'
import { client } from '../index'

const configCache = new Map<string, { auditLogChannelId: string | null; expiry: number }>()
const CACHE_TTL = 300000

async function getAuditLogChannelId(guildId: string): Promise<string | null> {
  const cached = configCache.get(guildId)
  if (cached && Date.now() < cached.expiry) return cached.auditLogChannelId

  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { auditLogChannelId: true }
  })

  // Fallback se 'none' acabar salvo (interface web legada enviou literally 'none')
  let channelId = config?.auditLogChannelId || null
  if (channelId === 'none') channelId = null

  configCache.set(guildId, { auditLogChannelId: channelId, expiry: Date.now() + CACHE_TTL })
  return channelId
}

type audit_action =
  | 'message_delete'
  | 'message_update'
  | 'member_nick_update'
  | 'member_roles_update'
  | 'channel_create'
  | 'channel_update'
  | 'channel_delete'

class AuditLogService {
  async log(input: {
    guildId: string
    action: audit_action
    actorUserId?: string | null
    targetUserId?: string | null
    targetChannelId?: string | null
    targetMessageId?: string | null
    data?: Prisma.InputJsonValue | null
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          guildId: input.guildId,
          action: input.action,
          actorUserId: input.actorUserId ?? null,
          targetUserId: input.targetUserId ?? null,
          targetMessageId: input.targetMessageId ?? null,
          data: input.data ?? null,
        },
      })

      // Broadcast para o Discord
      const channelId = await getAuditLogChannelId(input.guildId)
      if (channelId) {
        // Try to get guild from cache first, then fetch if not found
        let guild = client.guilds.cache.get(input.guildId)
        if (!guild) {
          try {
            guild = await client.guilds.fetch(input.guildId).catch(() => null)
          } catch (fetchError) {
            logger.warn({ err: safe_error_details(fetchError), guildId: input.guildId }, 'Failed to fetch guild for audit log')
          }
        }
        
        if (guild) {
          const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null)
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder().setTimestamp()
            const data = (input.data as Record<string, any>) || {}

            let color = 0x808080
            let title = 'Auditoria'

            switch (input.action) {
              case 'message_delete':
                title = '🗑️ Mensagem Deletada'
                color = 0xff4444
                if (data.authorTag) embed.addFields({ name: 'Autor', value: data.authorTag, inline: true })
                if (input.targetChannelId) embed.addFields({ name: 'Canal', value: `<#${input.targetChannelId}>`, inline: true })
                if (data.content) embed.setDescription(`**Conteúdo:**\n${data.content}`)
                if (Array.isArray(data.attachments) && data.attachments.length > 0) {
                  embed.setImage(data.attachments[0])
                }
                break;
              
              case 'message_update':
                title = '✏️ Mensagem Editada'
                color = 0x4488ff
                if (data.authorTag) embed.addFields({ name: 'Autor', value: data.authorTag, inline: true })
                if (input.targetChannelId) embed.addFields({ name: 'Canal', value: `<#${input.targetChannelId}>`, inline: true })
                if (input.targetMessageId && input.targetChannelId) embed.setDescription(`[Ir para Mensagem](https://discord.com/channels/${input.guildId}/${input.targetChannelId}/${input.targetMessageId})`)
                if (data.oldContent) embed.addFields({ name: 'Antes', value: String(data.oldContent).substring(0, 1024) })
                if (data.newContent) embed.addFields({ name: 'Depois', value: String(data.newContent).substring(0, 1024) })
                if (Array.isArray(data.attachments) && data.attachments.length > 0) {
                  embed.setImage(data.attachments[0])
                }
                break;
              
              case 'member_nick_update':
                title = '📝 Apelido Alterado'
                color = 0x4488ff
                if (input.targetUserId) embed.addFields({ name: 'Membro', value: `<@${input.targetUserId}>`, inline: true })
                embed.addFields({ name: 'Antes', value: data.oldNick || '*Nenhum*', inline: true })
                embed.addFields({ name: 'Depois', value: data.newNick || '*Nenhum*', inline: true })
                break;
                
              case 'member_roles_update':
                title = '🛡️ Cargos Atualizados'
                color = 0xffbb44
                if (input.targetUserId) embed.addFields({ name: 'Membro', value: `<@${input.targetUserId}>`, inline: false })
                if (Array.isArray(data.addedRoleIds) && data.addedRoleIds.length > 0) {
                   embed.addFields({ name: 'Adicionados', value: data.addedRoleIds.map((id:string) => `<@&${id}>`).join(', ') })
                }
                if (Array.isArray(data.removedRoleIds) && data.removedRoleIds.length > 0) {
                   embed.addFields({ name: 'Removidos', value: data.removedRoleIds.map((id:string) => `<@&${id}>`).join(', ') })
                }
                break;
                
              case 'channel_create':
                title = '➕ Canal Criado'
                color = 0x44ff44
                if (input.targetChannelId) embed.addFields({ name: 'Canal', value: `<#${input.targetChannelId}>`, inline: true })
                if (data.name) embed.addFields({ name: 'Nome', value: data.name, inline: true })
                break;
                
              case 'channel_delete':
                title = '➖ Canal Removido'
                color = 0xff4444
                if (data.name) embed.addFields({ name: 'Canal', value: `#${data.name}` })
                break;
                
              case 'channel_update':
                title = '⚙️ Canal Atualizado'
                color = 0xdddd44
                if (input.targetChannelId) embed.addFields({ name: 'Canal', value: `<#${input.targetChannelId}>` })
                if (data.oldName && data.newName && data.oldName !== data.newName) {
                   embed.addFields({ name: 'Nome', value: `${data.oldName} ➔ ${data.newName}` })
                }
                break;
            }

            embed.setTitle(title).setColor(color)
            await (channel as TextChannel).send({ embeds: [embed] }).catch((err) => {
              logger.warn({ err: safe_error_details(err), channelId, guildId: input.guildId }, 'Failed to send audit log embed')
            })
          } else {
            logger.warn({ channelId, guildId: input.guildId }, 'Audit log channel not found or not text-based')
          }
        } else {
          logger.warn({ guildId: input.guildId }, 'Guild not found in bot cache for audit log')
        }
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error), guildId: input.guildId, action: input.action }, 'Failed to write audit log')
    }
  }
}

export const auditLogService = new AuditLogService()
