import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js'
import { prisma } from '@yuebot/database'
import { normalize_giveaway_items_list } from '@yuebot/shared'
import { assign_giveaway_prizes } from './giveawayPrizeAssignment.logic'
import { logger } from '../utils/logger'
import { getSendableChannel } from '../utils/discord'
import { safe_error_details } from '../utils/safe_error'

export class GiveawayScheduler {
  private client: Client
  private interval: NodeJS.Timeout | null = null

  constructor(client: Client) {
    this.client = client
  }

  start() {
    // Verificar a cada 30 segundos
    this.interval = setInterval(() => this.checkGiveaways(), 30000)
    logger.info('🎉 Scheduler de sorteios iniciado')
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
      logger.info('🎉 Scheduler de sorteios parado')
    }
  }

  private async publishPendingGiveaways(now: Date) {
    const pending = await prisma.giveaway.findMany({
      where: {
        ended: false,
        cancelled: false,
        suspended: false,
        messageId: null,
        endsAt: { gt: now },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 50,
    })

    for (const giveaway of pending) {
      try {
        const channel = await this.client.channels.fetch(giveaway.channelId).catch(() => null)
        const sendableChannel = getSendableChannel(channel)
        if (!sendableChannel) {
          logger.warn(
            { giveawayId: giveaway.id, guildId: giveaway.guildId, channelId: giveaway.channelId },
            'Canal do sorteio não é enviável; aguardando'
          )
          continue
        }

        const ends_at_ts = Math.floor(new Date(giveaway.endsAt).getTime() / 1000)

        const items =
          giveaway.format === 'list' && Array.isArray(giveaway.availableItems)
            ? normalize_giveaway_items_list(giveaway.availableItems as string[])
            : []

        const min_choices = typeof giveaway.minChoices === 'number' ? giveaway.minChoices : 3
        const max_choices = typeof giveaway.maxChoices === 'number' ? giveaway.maxChoices : 10

        const embed = new EmbedBuilder()
          .setTitle(`${giveaway.format === 'list' ? '🎁' : '🎉'} ${giveaway.title}`)
          .setDescription(
            giveaway.format === 'list'
              ? `${giveaway.description}\n\n` +
                  `📋 **${items.length} itens disponíveis**\n` +
                  `✅ Escolha entre ${min_choices} e ${max_choices} itens\n\n` +
                  `Clique no botão abaixo para participar!`
              : giveaway.description
          )
          .addFields(
            { name: '🏆 Vencedores', value: String(giveaway.maxWinners), inline: true },
            { name: '⏰ Termina', value: `<t:${ends_at_ts}:R>`, inline: true },
            { name: '📋 Participantes', value: '0', inline: true }
          )
          .setColor(0x9333ea)
          .setTimestamp(new Date(giveaway.endsAt))

        const required_role_ids =
          Array.isArray(giveaway.requiredRoleIds) && giveaway.requiredRoleIds.length > 0
            ? (giveaway.requiredRoleIds as string[])
            : giveaway.requiredRoleId
              ? [giveaway.requiredRoleId]
              : []

        if (required_role_ids.length > 0) {
          embed.addFields({
            name: '🚪 Cargo necessário',
            value: required_role_ids.map((id) => `<@&${id}>`).join(' ou '),
            inline: false,
          })
        }

        const role_ping =
          required_role_ids.length > 0 ? required_role_ids.map((id) => `<@&${id}>`).join(' ') : ''

        const message =
          giveaway.format === 'list'
            ? await sendableChannel.send({
                content: role_ping || undefined,
                embeds: [embed],
                components: [
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId('giveaway_participate')
                      .setLabel('✨ Participar do Sorteio')
                      .setStyle(ButtonStyle.Primary)
                  ),
                ],
                allowedMentions: { roles: required_role_ids },
              })
            : await sendableChannel.send({
                content: role_ping || undefined,
                embeds: [embed],
                allowedMentions: { roles: required_role_ids },
              })

        if (giveaway.format === 'list' && items.length > 0) {
          const items_list = items.map((item, i) => `${i + 1}. ${item}`).join('\n')
          const chunks: string[] = []

          let current_chunk = ''
          for (const line of items_list.split('\n')) {
            if (current_chunk.length + line.length + 1 > 1900) {
              chunks.push(current_chunk)
              current_chunk = line
            } else {
              current_chunk += (current_chunk ? '\n' : '') + line
            }
          }
          if (current_chunk) chunks.push(current_chunk)

          for (let i = 0; i < chunks.length; i++) {
            const list_embed = new EmbedBuilder()
              .setTitle(i === 0 ? `📋 Lista de Itens Disponíveis` : `📋 Lista (continuação ${i + 1})`)
              .setDescription(chunks[i])
              .setColor(0x3b82f6)
              .setFooter({ text: `Total: ${items.length} itens | Página ${i + 1}/${chunks.length}` })

            await sendableChannel.send({ embeds: [list_embed] })
          }
        }

        if (giveaway.format === 'reaction') {
          await message.react('🎉').catch(() => null)
        }

        await prisma.giveaway.update({
          where: { id: giveaway.id },
          data: { messageId: message.id },
        })

        logger.info({ giveawayId: giveaway.id, messageId: message.id }, 'Sorteio publicado no Discord')
      } catch (error) {
        logger.error({ err: safe_error_details(error), giveawayId: giveaway.id }, 'Falha ao publicar sorteio pendente')
      }
    }
  }

  private async checkGiveaways() {
    try {
      const now = new Date()

      await this.publishPendingGiveaways(now)
      
      // Buscar sorteios que devem ser finalizados
      const expiredGiveaways = await prisma.giveaway.findMany({
        where: {
          ended: false,
          cancelled: false,
          suspended: false,
          endsAt: { lte: now },
        },
        include: {
          entries: {
            where: { disqualified: false },
          },
        },
      })

      for (const giveaway of expiredGiveaways) {
        await this.endGiveaway(giveaway)
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao verificar sorteios')
    }
  }

  private async endGiveaway(giveaway: any) {
    try {
      logger.info(`Finalizando sorteio: ${giveaway.id}`)

      const eligibleEntries = giveaway.entries.filter((e: any) => !e.disqualified)
      
      if (eligibleEntries.length === 0) {
        await prisma.giveaway.update({
          where: { id: giveaway.id },
          data: { ended: true },
        })
        
        await this.announceNoWinners(giveaway)
        return
      }

      // Selecionar vencedores considerando chances por cargo
      const winnerCount = Math.min(giveaway.maxWinners, eligibleEntries.length)
      const selectedWinners = await this.selectWinnersWithRoleChances(giveaway, eligibleEntries, winnerCount)

      // Se for sorteio com lista, distribuir prêmios baseado em preferências
      let winnersData: any[] = []
      if (giveaway.format === 'list' && giveaway.availableItems) {
        const items = Array.isArray(giveaway.availableItems)
          ? normalize_giveaway_items_list(giveaway.availableItems as string[])
          : []

        winnersData = assign_giveaway_prizes({ winners: selectedWinners, availableItems: items })
      } else {
        winnersData = selectedWinners.map((w: any) => ({
          userId: w.userId,
          username: w.username,
          prize: null,
          prizeIndex: null,
        }))
      }

      // Salvar vencedores
      await prisma.$transaction([
        ...winnersData.map((w: any) => 
          prisma.giveawayWinner.create({
            data: {
              giveawayId: giveaway.id,
              userId: w.userId,
              username: w.username,
              prize: w.prize,
              prizeIndex: w.prizeIndex,
            },
          })
        ),
        prisma.giveaway.update({
          where: { id: giveaway.id },
          data: { ended: true },
        }),
      ])

      // Anunciar vencedores
      await this.announceWinners(giveaway, winnersData)
      
      // Enviar DM para vencedores
      await this.notifyWinners(giveaway, winnersData)
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, `Erro ao finalizar sorteio ${giveaway.id}`)
    }
  }

  private async selectWinnersWithRoleChances(giveaway: any, eligibleEntries: any[], winnerCount: number): Promise<any[]> {
    // Se não houver configuração de chances por cargo, usar método tradicional
    if (!giveaway.roleChances || !Array.isArray(giveaway.roleChances) || giveaway.roleChances.length === 0) {
      const shuffled = eligibleEntries.sort(() => Math.random() - 0.5)
      return shuffled.slice(0, winnerCount)
    }

    // Criar pool de entradas considerando multiplicadores de cargo
    const entryPool: any[] = []
    
    for (const entry of eligibleEntries) {
      // Buscar membro para verificar cargos
      const guild = await this.client.guilds.fetch(giveaway.guildId).catch(() => null)
      if (!guild) continue
      
      const member = await guild.members.fetch(entry.userId).catch(() => null)
      if (!member) continue
      
      // Calcular multiplicador baseado nos cargos do usuário
      let multiplier = 1
      
      if (Array.isArray(giveaway.roleChances)) {
        for (const roleChance of giveaway.roleChances) {
          if (member.roles.cache.has(roleChance.roleId)) {
            multiplier = Math.max(multiplier, roleChance.multiplier || 1)
          }
        }
      }
      
      // Adicionar entrada ao pool múltiplas vezes (baseado no multiplicador)
      for (let i = 0; i < multiplier; i++) {
        entryPool.push(entry)
      }
    }
    
    // Se o pool estiver vazio, voltar ao método tradicional
    if (entryPool.length === 0) {
      const shuffled = eligibleEntries.sort(() => Math.random() - 0.5)
      return shuffled.slice(0, winnerCount)
    }
    
    // Embaralhar o pool e selecionar vencedores
    const shuffledPool = entryPool.sort(() => Math.random() - 0.5)
    
    // Remover duplicatas (um usuário pode ganhar apenas uma vez)
    const uniqueWinners: any[] = []
    const winnerUserIds = new Set()
    
    for (const entry of shuffledPool) {
      if (winnerUserIds.size >= winnerCount) break
      if (!winnerUserIds.has(entry.userId)) {
        uniqueWinners.push(entry)
        winnerUserIds.add(entry.userId)
      }
    }
    
    return uniqueWinners
  }

  private async notifyWinners(giveaway: any, winners: any[]) {
    for (const winner of winners) {
      try {
        const user = await this.client.users.fetch(winner.userId)
        
        let message = `🎉 **Parabéns! Você ganhou no sorteio "${giveaway.title}"!**\n\n`
        
        if (winner.prize) {
          message += `🎁 **Seu prêmio:** ${winner.prize}\n\n`
        }
        
        message += `Servidor: ${giveaway.guildId}\n`
        message += `Data: ${new Date().toLocaleString('pt-BR')}`
        
        await user.send(message)
        
        // Marcar como notificado
        await prisma.giveawayWinner.updateMany({
          where: { 
            giveawayId: giveaway.id,
            userId: winner.userId 
          },
          data: { notified: true }
        })
        
        logger.info(`DM enviado para vencedor ${winner.username}`)
      } catch (error) {
        logger.error({ err: safe_error_details(error) }, `Erro ao enviar DM para ${winner.username}`)
      }
    }
  }

  private async announceWinners(giveaway: any, winners: any[]) {
    try {
      const channel = await this.client.channels.fetch(giveaway.channelId)
      const sendableChannel = getSendableChannel(channel)
      if (!sendableChannel) return

      // Criar mensagem de resultados
      let resultsText = ''
      if (giveaway.format === 'list' && winners[0]?.prize) {
        // Formato com prêmios
        resultsText = winners.map(w => `<@${w.userId}>: **${w.prize}**`).join('\n')
      } else {
        // Formato simples
        resultsText = winners.map(w => `<@${w.userId}>`).join(', ')
      }
      
      const embed = new EmbedBuilder()
        .setTitle(`🎊 Sorteio Finalizado: ${giveaway.title}`)
        .setDescription(`**Vencedores:**\n${resultsText}\n\nParabéns! 🎉`)
        .setColor(0x10B981)
        .setFooter({ text: `${winners.length} vencedor(es)` })
        .setTimestamp()

      await sendableChannel.send({ embeds: [embed] })

      // Tentar editar mensagem original
      if (giveaway.messageId) {
        try {
          const message = await sendableChannel.messages.fetch(giveaway.messageId)
          const oldEmbed = message.embeds[0]
          
          if (oldEmbed) {
            const newEmbed = new EmbedBuilder()
              .setTitle(`🏁 ${oldEmbed.title || giveaway.title}`)
              .setDescription(oldEmbed.description || giveaway.description)
              .addFields(
                { name: '🏆 Vencedores', value: `${winners.length}`, inline: true },
                { name: '⏰ Finalizado', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true },
                { name: '📋 Participantes', value: String(giveaway.entries.length), inline: true }
              )
              .setColor(0xEF4444)
              .setFooter({ text: 'Sorteio finalizado!' })
              .setTimestamp()

            await message.edit({ embeds: [newEmbed] })
          }
        } catch (error) {
          logger.warn({ err: safe_error_details(error) }, 'Não foi possível editar mensagem do sorteio')
        }
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao anunciar vencedores')
    }
  }

  private async announceNoWinners(giveaway: any) {
    try {
      const channel = await this.client.channels.fetch(giveaway.channelId)
      const sendableChannel = getSendableChannel(channel)
      if (!sendableChannel) return

      const embed = new EmbedBuilder()
        .setTitle(`😔 Sorteio Finalizado: ${giveaway.title}`)
        .setDescription('Nenhum participante elegível. O sorteio foi cancelado.')
        .setColor(0xEF4444)
        .setTimestamp()

      await sendableChannel.send({ embeds: [embed] })
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao anunciar sorteio sem vencedores')
    }
  }
}
