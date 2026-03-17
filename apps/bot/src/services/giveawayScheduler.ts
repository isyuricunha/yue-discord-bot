import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js'
import { prisma } from '@yuebot/database'
import { normalize_giveaway_items_list, COLORS, EMOJIS } from '@yuebot/shared'
import { assign_giveaway_prizes } from './giveawayPrizeAssignment.logic'
import { logger } from '../utils/logger'
import { getSendableChannel } from '../utils/discord'
import { safe_error_details } from '../utils/safe_error'
import { Queue, Worker, Job } from 'bullmq'
import { get_redis_connection } from './queue.connection'

export class GiveawayScheduler {
  private client: Client
  private queue: Queue
  private worker: Worker
  private intervalCheck: NodeJS.Timeout | null = null

  constructor(client: Client) {
    this.client = client
    
    // Instanciar a fila no Redis
    const redis_connection = get_redis_connection()
    this.queue = new Queue('giveaway-queue', { connection: redis_connection as any })

    // Declarar o Worker que resolverá a etapa final do Sorteio
    this.worker = new Worker(
      'giveaway-queue',
      async (job: Job) => {
        if (job.name === 'end-giveaway') {
          const { giveawayId } = job.data
          // Buscar Giveaway atualizado do banco de dados na hora de finalizar
          const giveaway = await prisma.giveaway.findUnique({
            where: { id: giveawayId },
            include: {
              entries: { where: { disqualified: false } },
            },
          })

          if (giveaway && !giveaway.ended && !giveaway.cancelled) {
            await this.endGiveaway(giveaway)
          }
        }
      },
      { connection: redis_connection as any }
    )

    this.worker.on('failed', (job, err) => {
      logger.error({ err, jobId: job?.id }, '❌ Erro no Worker do Giveaway')
    })
  }

  start() {
    // Manter um interval rápido apenas para a detecção inicial/publicação de sorteios 
    // e para redirecionar o final para o BullMQ se não tiver no cache dele.
    this.intervalCheck = setInterval(() => this.checkAndScheduleGiveaways(), 15000)
    logger.info('🎉 Scheduler de sorteios (BullMQ) iniciado')
  }

  async stop() {
    if (this.intervalCheck) {
      clearInterval(this.intervalCheck)
      this.intervalCheck = null
    }
    await this.worker.close()
    await this.queue.close()
    logger.info('🎉 Scheduler de sorteios (BullMQ) parado')
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

  private async checkAndScheduleGiveaways() {
    try {
      const now = new Date()

      await this.publishPendingGiveaways(now)
      
      // Buscar sorteios que devem ser finalizados / Agendados hoje
      const liveGiveaways = await prisma.giveaway.findMany({
        where: {
          ended: false,
          cancelled: false,
          suspended: false,
        },
      })

      for (const giveaway of liveGiveaways) {
        // Obter job atual agendado com ID identificável (giveaway.id) para não agendar 2x
        const jobId = `end-giveaway-${giveaway.id}`
        const delayed = new Date(giveaway.endsAt).getTime() - now.getTime()

        // Se sorteio já passou do horário estrito e job perdeu (por falha do bot), finaliza imediato
        if (delayed <= 0) {
          const giveawayContext = await prisma.giveaway.findUnique({
             where: { id: giveaway.id },
             include: { entries: { where: { disqualified: false } } }
          })
          if(giveawayContext && !giveawayContext.ended) {
            await this.endGiveaway(giveawayContext)
          }
          continue
        }

        // Agendar/Renovar Job apenas se já não houver job programado na fila do BullMQ
        const job = await this.queue.getJob(jobId)
        if (!job) {
          await this.queue.add(
            'end-giveaway', 
            { giveawayId: giveaway.id },
            { 
              jobId,
              delay: delayed > 0 ? delayed : 0, 
              removeOnComplete: true 
            }
          )
          logger.info(`Agendando Job BullMQ para finalização do sorteio: ${giveaway.id} em ${delayed}ms`)
        }
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao agendar sorteios com BullMQ')
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
    // Buscar o nome do servidor
    let serverName = 'Servidor desconhecido'
    try {
      const guild = await this.client.guilds.fetch(giveaway.guildId).catch(() => null)
      if (guild) {
        serverName = guild.name
      }
    } catch (error) {
      logger.warn({ err: safe_error_details(error) }, 'Erro ao buscar nome do servidor para DM de vencedor')
    }

    for (const winner of winners) {
      try {
        const user = await this.client.users.fetch(winner.userId)
        
        // Criar embed profissional para o vencedor
        const winnerEmbed = new EmbedBuilder()
          .setColor(COLORS.GIVEAWAY)
          .setTitle(`${EMOJIS.GIVEAWAY} Parabéns! Você ganhou um sorteio!`)
          .setDescription(
            `Você foi selecionado como vencedor no sorteio: **${giveaway.title}**`
          )
          .addFields(
            { 
              name: '🎁 Sorteio', 
              value: giveaway.title, 
              inline: true 
            },
            { 
              name: '🏠 Servidor', 
              value: serverName, 
              inline: true 
            },
            ...(winner.prize 
              ? [{ name: '🎯 Prêmio', value: winner.prize, inline: false } as any]
              : []
            ),
            { 
              name: '📅 Data', 
              value: new Date().toLocaleString('pt-BR', { 
                timeZone: 'America/Sao_Paulo',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }), 
              inline: true 
            }
          )
          .setFooter({ 
            text: 'Obrigado por participar! 🎉',
            iconURL: this.client.user?.avatarURL() || undefined
          })
          .setTimestamp()

        await user.send({ embeds: [winnerEmbed] })
        
        // Marcar como notificado
        await prisma.giveawayWinner.updateMany({
          where: { 
            giveawayId: giveaway.id,
            userId: winner.userId 
          },
          data: { notified: true }
        })
        
        logger.info({ winnerId: winner.userId, giveawayId: giveaway.id }, 'DM de vencedor enviado com sucesso')
      } catch (error) {
        // Usuário pode ter DM desativado - não é um erro crítico
        logger.warn({ err: safe_error_details(error), winnerId: winner.userId }, 'Não foi possível enviar DM para vencedor (provavelmente tem DM desativado)')
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
