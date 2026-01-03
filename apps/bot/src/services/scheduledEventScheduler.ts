import { Client, EmbedBuilder } from 'discord.js'
import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import { logger } from '../utils/logger'
import { getSendableChannel } from '../utils/discord'
import { safe_error_details } from '../utils/safe_error'

const REMINDER_24H_MS = 24 * 60 * 60 * 1000
const REMINDER_1H_MS = 60 * 60 * 1000
const REMINDER_10M_MS = 10 * 60 * 1000

function to_unix_seconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

export class ScheduledEventScheduler {
  private interval: NodeJS.Timeout | null = null

  constructor(private client: Client) {}

  start() {
    this.interval = setInterval(() => {
      this.tick()
    }, 30 * 1000)

    this.tick()

    logger.info('📅 Scheduler de eventos agendados iniciado')
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
      logger.info('📅 Scheduler de eventos agendados parado')
    }
  }

  private async tick() {
    try {
      const now = new Date()

      await this.process_24h(now)
      await this.process_1h(now)
      await this.process_10m(now)

      await this.mark_due_as_ended(now)
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao processar scheduler de eventos agendados')
    }
  }

  private async process_24h(now: Date) {
    const due = await prisma.scheduledEvent.findMany({
      where: {
        ended: false,
        cancelled: false,
        reminder24hSent: false,
        startsAt: { gt: now },
        reminder24hAt: { lte: now },
      },
      orderBy: [{ reminder24hAt: 'asc' }],
      take: 50,
    })

    for (const event of due) {
      await this.send_reminder(now, event, 'reminder24hSent', 'reminder24hAt', '⏰ Faltam 24 horas')
    }
  }

  private async process_1h(now: Date) {
    const due = await prisma.scheduledEvent.findMany({
      where: {
        ended: false,
        cancelled: false,
        reminder1hSent: false,
        startsAt: { gt: now },
        reminder1hAt: { lte: now },
      },
      orderBy: [{ reminder1hAt: 'asc' }],
      take: 50,
    })

    for (const event of due) {
      await this.send_reminder(now, event, 'reminder1hSent', 'reminder1hAt', '⏰ Faltam 1 hora')
    }
  }

  private async process_10m(now: Date) {
    const due = await prisma.scheduledEvent.findMany({
      where: {
        ended: false,
        cancelled: false,
        reminder10mSent: false,
        startsAt: { gt: now },
        reminder10mAt: { lte: now },
      },
      orderBy: [{ reminder10mAt: 'asc' }],
      take: 50,
    })

    for (const event of due) {
      await this.send_reminder(now, event, 'reminder10mSent', 'reminder10mAt', '⏰ Faltam 10 minutos')
    }
  }

  private async send_reminder(
    now: Date,
    event: {
      id: string
      guildId: string
      channelId: string
      title: string
      description: string | null
      startsAt: Date
    },
    sent_field: 'reminder24hSent' | 'reminder1hSent' | 'reminder10mSent',
    at_field: 'reminder24hAt' | 'reminder1hAt' | 'reminder10mAt',
    header: string
  ) {
    try {
      const channel = await this.client.channels.fetch(event.channelId).catch(() => null)
      const sendable = getSendableChannel(channel)
      if (!sendable) {
        logger.warn({ scheduledEventId: event.id, guildId: event.guildId, channelId: event.channelId }, 'Canal do evento não é enviável; ignorando reminder')
        await prisma.scheduledEvent.update({
          where: { id: event.id },
          data: {
            [sent_field]: true,
            [at_field]: now,
          },
        })
        return
      }

      const starts_ts = to_unix_seconds(new Date(event.startsAt))
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${header}: ${event.title}`)
        .addFields({ name: '📅 Começa', value: `<t:${starts_ts}:F> (<t:${starts_ts}:R>)`, inline: false })

      if (event.description) {
        embed.setDescription(event.description)
      }

      await sendable.send({
        content: `${EMOJIS.INFO} **Evento:** ${event.title}`,
        embeds: [embed],
        allowedMentions: { parse: [] },
      })

      await prisma.scheduledEvent.update({
        where: { id: event.id },
        data: {
          [sent_field]: true,
          [at_field]: now,
        },
      })
    } catch (error) {
      logger.error({ err: safe_error_details(error), scheduledEventId: event.id }, 'Falha ao enviar reminder de evento agendado')
    }
  }

  private async mark_due_as_ended(now: Date) {
    try {
      await prisma.scheduledEvent.updateMany({
        where: {
          ended: false,
          cancelled: false,
          startsAt: {
            lt: new Date(now.getTime() - 5 * 60 * 1000),
          },
        },
        data: {
          ended: true,
        },
      })
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Erro ao finalizar eventos automaticamente')
    }
  }
}
