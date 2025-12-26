import { Client, EmbedBuilder } from 'discord.js'
import { prisma } from '@yuebot/database'
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

  private async checkGiveaways() {
    try {
      const now = new Date()
      
      // Buscar sorteios que devem ser finalizados
      const expiredGiveaways = await prisma.giveaway.findMany({
        where: {
          ended: false,
          cancelled: false,
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

      // Selecionar vencedores
      const winnerCount = Math.min(giveaway.maxWinners, eligibleEntries.length)
      const shuffled = eligibleEntries.sort(() => Math.random() - 0.5)
      const selectedWinners = shuffled.slice(0, winnerCount)

      // Se for sorteio com lista, distribuir prêmios baseado em preferências
      let winnersData: any[] = []
      if (giveaway.format === 'list' && giveaway.availableItems) {
        winnersData = this.assignPrizes(selectedWinners, giveaway.availableItems)
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

  private assignPrizes(winners: any[], availableItems: string[]): any[] {
    const assignedPrizes = new Set<string>()
    const results: any[] = []

    for (const winner of winners) {
      const choices = (winner.choices as string[]) || []
      let assignedPrize: string | null = null
      let prizeIndex: number | null = null

      // Tentar atribuir a primeira escolha disponível
      for (const choice of choices) {
        if (!assignedPrizes.has(choice)) {
          assignedPrize = choice
          prizeIndex = availableItems.indexOf(choice)
          assignedPrizes.add(choice)
          break
        }
      }

      // Se não conseguiu pelas preferências, pegar qualquer item disponível
      if (!assignedPrize) {
        for (let i = 0; i < availableItems.length; i++) {
          const item = availableItems[i]
          if (!assignedPrizes.has(item)) {
            assignedPrize = item
            prizeIndex = i
            assignedPrizes.add(item)
            break
          }
        }
      }

      results.push({
        userId: winner.userId,
        username: winner.username,
        prize: assignedPrize,
        prizeIndex,
      })
    }

    return results
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
