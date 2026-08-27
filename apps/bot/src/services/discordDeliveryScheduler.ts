import { Client, EmbedBuilder } from 'discord.js'
import {
  prisma,
  SupportEntitlementStatus,
  SupportRoleSyncStatus,
  type DiscordDelivery,
} from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'
import { getSendableChannel } from '../utils/discord'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

const INTERVAL_MS = 5_000
const CLAIM_LEASE_MS = 2 * 60_000
const MAX_ATTEMPTS = 12
const MAX_BACKOFF_MS = 5 * 60_000

class TerminalDeliveryError extends Error {}

function error_code(error: unknown): string {
  const code = (error as { code?: unknown })?.code
  return typeof code === 'string' || typeof code === 'number' ? String(code) : ''
}

export function is_terminal_discord_delivery_error(error: unknown): boolean {
  if (error instanceof TerminalDeliveryError) return true
  return new Set(['10003', '10007', '10008', '10013', '50001', '50007', '50013']).has(error_code(error))
}

export function discord_delivery_retry_delay_ms(attempt: number): number {
  const exponent = Math.max(0, Math.min(10, attempt - 1))
  return Math.min(MAX_BACKOFF_MS, 5_000 * (2 ** exponent))
}

function error_message(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 1_000)
}

function payload_of(row: DiscordDelivery): Record<string, unknown> {
  if (!row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) return {}
  return row.payload as Record<string, unknown>
}

function required_string(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TerminalDeliveryError(`invalid_${name}`)
  return value
}

function required_number(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TerminalDeliveryError(`invalid_${name}`)
  return value
}

function delivery_log_data(row: DiscordDelivery, attempt: number) {
  return {
    deliveryId: row.id,
    kind: row.kind,
    guildId: row.guildId,
    channelId: row.channelId,
    userId: row.userId,
    attempt,
  }
}

export class DiscordDeliveryScheduler {
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(private readonly client: Client) {}

  start() {
    if (this.timer) return
    this.timer = setInterval(() => void this.run_once(), INTERVAL_MS)
    this.timer.unref?.()
    void this.run_once()
    logger.info('📨 Scheduler de entregas Discord iniciado')
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private async run_once() {
    if (this.running) return
    this.running = true
    try {
      const now = new Date()
      const lease_cutoff = new Date(now.getTime() - CLAIM_LEASE_MS)
      const due = await prisma.discordDelivery.findMany({
        where: {
          deliveredAt: null,
          failedAt: null,
          availableAt: { lte: now },
          OR: [{ claimedAt: null }, { claimedAt: { lte: lease_cutoff } }],
        },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
        take: 50,
      })

      for (const row of due) {
        const claimed_at = new Date()
        const claimed = await prisma.discordDelivery.updateMany({
          where: {
            id: row.id,
            deliveredAt: null,
            failedAt: null,
            availableAt: { lte: claimed_at },
            OR: [{ claimedAt: null }, { claimedAt: { lte: lease_cutoff } }],
          },
          data: { claimedAt: claimed_at, attempts: { increment: 1 } },
        })
        if (claimed.count === 0) continue

        const attempt = row.attempts + 1
        try {
          await this.deliver(row)
          await prisma.discordDelivery.update({
            where: { id: row.id },
            data: { deliveredAt: new Date(), claimedAt: null, lastError: null },
          })

          const log_data = delivery_log_data(row, attempt)
          if (row.kind === 'free_game_announcement') {
            logger.info(log_data, '✅ Jogo grátis entregue no Discord')
          } else {
            logger.debug(log_data, '✅ Entrega Discord concluída')
          }
        } catch (error) {
          const terminal = is_terminal_discord_delivery_error(error) || attempt >= MAX_ATTEMPTS
          const message = error_message(error)
          await prisma.discordDelivery.update({
            where: { id: row.id },
            data: terminal
              ? { failedAt: new Date(), claimedAt: null, lastError: message }
              : {
                  claimedAt: null,
                  availableAt: new Date(Date.now() + discord_delivery_retry_delay_ms(attempt)),
                  lastError: message,
                },
          })
          const log_data = {
            ...delivery_log_data(row, attempt),
            terminal,
            errorCode: error_code(error) || undefined,
            err: safe_error_details(error),
          }
          if (terminal) logger.error(log_data, '❌ Entrega Discord falhou permanentemente')
          else logger.warn(log_data, '⚠️ Entrega Discord falhou; nova tentativa agendada')
        }
      }
    } finally {
      this.running = false
    }
  }

  private async send_channel_message(channel_id: string, message: unknown) {
    const channel = await this.client.channels.fetch(channel_id).catch(() => null)
    const sendable = getSendableChannel(channel)
    if (!sendable) throw new TerminalDeliveryError('channel_not_sendable')
    await sendable.send(message as any)
  }

  private async send_user_message(user_id: string, message: unknown) {
    const user = await this.client.users.fetch(user_id)
    await user.send(message as any)
  }

  private async deliver(row: DiscordDelivery): Promise<void> {
    const payload = payload_of(row)

    if (row.kind === 'channel_message' || row.kind === 'free_game_announcement') {
      await this.send_channel_message(required_string(row.channelId, 'channel_id'), payload.message)
      return
    }

    if (row.kind === 'user_dm') {
      await this.send_user_message(required_string(row.userId, 'user_id'), payload.message)
      return
    }

    if (row.kind === 'giveaway_result') {
      await this.deliver_giveaway_result(required_string(payload.giveawayId, 'giveaway_id'))
      return
    }

    if (row.kind === 'giveaway_message_edit') {
      await this.deliver_giveaway_message_edit(required_string(payload.giveawayId, 'giveaway_id'))
      return
    }

    if (row.kind === 'giveaway_winner_dm') {
      await this.deliver_giveaway_winner_dm(
        required_string(payload.giveawayId, 'giveaway_id'),
        required_string(payload.userId, 'user_id'),
      )
      return
    }

    if (row.kind === 'anilist_episode_dm' || row.kind === 'anilist_episode_channel') {
      const embed = this.build_anilist_embed(payload)
      if (row.kind === 'anilist_episode_dm') {
        await this.send_user_message(required_string(row.userId, 'user_id'), { embeds: [embed] })
      } else {
        const user_id = required_string(row.userId, 'user_id')
        await this.send_channel_message(required_string(row.channelId, 'channel_id'), {
          content: `<@${user_id}>`,
          embeds: [embed],
          allowedMentions: { users: [user_id] },
        })
      }
      return
    }

    if (row.kind === 'support_payment_dm') {
      await this.deliver_support_payment_dm(row, payload)
      return
    }

    if (row.kind === 'support_reminder_dm') {
      await this.deliver_support_reminder_dm(row, payload)
      return
    }

    if (row.kind === 'support_role_remove') {
      await this.deliver_support_role_remove(payload)
      return
    }

    throw new TerminalDeliveryError(`unknown_delivery_kind:${row.kind}`)
  }

  private async deliver_giveaway_result(giveaway_id: string) {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveaway_id },
      include: { winners: true },
    })
    if (!giveaway) return

    const winners = giveaway.winners
    const results = winners.length === 0
      ? 'Nenhum participante elegível. O sorteio foi encerrado sem vencedores.'
      : giveaway.format === 'list' && winners[0]?.prize
        ? winners.map((winner) => `<@${winner.userId}>: **${winner.prize}**`).join('\n')
        : winners.map((winner) => `<@${winner.userId}>`).join(', ')

    const embed = new EmbedBuilder()
      .setTitle(winners.length === 0 ? `😔 Sorteio Finalizado: ${giveaway.title}` : `🎊 Sorteio Finalizado: ${giveaway.title}`)
      .setDescription(winners.length === 0 ? results : `**Vencedores:**\n${results}\n\nParabéns! 🎉`)
      .setColor(winners.length === 0 ? 0xEF4444 : 0x10B981)
      .setTimestamp()

    if (winners.length > 0) embed.setFooter({ text: `${winners.length} vencedor(es)` })
    await this.send_channel_message(giveaway.channelId, { embeds: [embed] })
  }

  private async deliver_giveaway_message_edit(giveaway_id: string) {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveaway_id },
      include: { winners: { select: { id: true } }, entries: { select: { id: true } } },
    })
    if (!giveaway?.messageId) return

    const channel = await this.client.channels.fetch(giveaway.channelId).catch(() => null)
    const sendable = getSendableChannel(channel)
    if (!sendable) throw new TerminalDeliveryError('channel_not_sendable')
    const message = await (sendable as any).messages.fetch(giveaway.messageId)
    const oldEmbed = message.embeds?.[0]
    if (!oldEmbed) return

    const embed = new EmbedBuilder()
      .setTitle(`🏁 ${oldEmbed.title || giveaway.title}`)
      .setDescription(oldEmbed.description || giveaway.description)
      .addFields(
        { name: '🏆 Vencedores', value: String(giveaway.winners.length), inline: true },
        { name: '⏰ Finalizado', value: `<t:${Math.floor(Date.now() / 1000)}:R> (<t:${Math.floor(Date.now() / 1000)}:F>)`, inline: true },
        { name: '📋 Participantes', value: String(giveaway.entries.length), inline: true },
      )
      .setColor(0xEF4444)
      .setFooter({ text: 'Sorteio finalizado!' })
      .setTimestamp()

    await message.edit({ embeds: [embed] })
  }

  private async deliver_giveaway_winner_dm(giveaway_id: string, user_id: string) {
    const winner = await prisma.giveawayWinner.findUnique({
      where: { giveawayId_userId: { giveawayId: giveaway_id, userId: user_id } },
      include: { giveaway: true },
    })
    if (!winner || winner.notified) return

    const guild = await this.client.guilds.fetch(winner.giveaway.guildId).catch(() => null)
    const server_name = guild?.name ?? 'Servidor desconhecido'
    const embed = new EmbedBuilder()
      .setColor(COLORS.GIVEAWAY)
      .setTitle(`${EMOJIS.GIVEAWAY} Parabéns! Você ganhou um sorteio!`)
      .setDescription(`Você foi selecionado como vencedor no sorteio: **${winner.giveaway.title}**`)
      .addFields(
        { name: '🎁 Sorteio', value: winner.giveaway.title, inline: true },
        { name: '🏠 Servidor', value: server_name, inline: true },
        ...(winner.prize ? [{ name: '🎯 Prêmio', value: winner.prize, inline: false }] : []),
      )
      .setFooter({ text: 'Obrigado por participar! 🎉', iconURL: this.client.user?.avatarURL() || undefined })
      .setTimestamp()

    await this.send_user_message(winner.userId, { embeds: [embed] })
    await prisma.giveawayWinner.update({ where: { id: winner.id }, data: { notified: true } })
  }

  private build_anilist_embed(payload: Record<string, unknown>) {
    const title = required_string(payload.title, 'title')
    const airing_at = required_number(payload.airingAt, 'airing_at')
    const episode = required_number(payload.episode, 'episode')
    const site_url = typeof payload.siteUrl === 'string' ? payload.siteUrl : null
    const image_url = typeof payload.imageUrl === 'string' ? payload.imageUrl : null

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} Novo episódio disponível!`)
      .setDescription(`**${title}**${site_url ? `\n${site_url}` : ''}`)
      .addFields(
        { name: 'Episódio', value: String(episode), inline: true },
        { name: 'Quando', value: `<t:${airing_at}:F> (<t:${airing_at}:R>)`, inline: true },
      )
    if (image_url) embed.setThumbnail(image_url)
    return embed
  }

  private async deliver_support_payment_dm(row: DiscordDelivery, payload: Record<string, unknown>) {
    const entitlement_id = required_string(payload.entitlementId, 'entitlement_id')
    const entitlement = await prisma.supportEntitlement.findUnique({ where: { id: entitlement_id } })
    if (!entitlement) return
    if (entitlement.status !== SupportEntitlementStatus.ACTIVE) return
    if (entitlement.roleSyncStatus !== SupportRoleSyncStatus.SYNCED) throw new Error('support_role_not_synced')

    const guild = await this.client.guilds.fetch(required_string(row.guildId, 'guild_id')).catch(() => null)
    if (!guild) throw new Error('support_guild_unavailable')
    const expires_at = entitlement.expiresAt
    await this.send_user_message(required_string(row.userId, 'user_id'), {
      content:
        `Seu pagamento em **${guild.name}** foi confirmado e o cargo foi atualizado.\n` +
        `Expira em: <t:${Math.floor(expires_at.getTime() / 1000)}:F>`,
      allowedMentions: { parse: [] },
    })
  }

  private async deliver_support_reminder_dm(row: DiscordDelivery, payload: Record<string, unknown>) {
    const entitlement_id = required_string(payload.entitlementId, 'entitlement_id')
    const expected_expiration = required_string(payload.expiresAt, 'expires_at')
    const entitlement = await prisma.supportEntitlement.findUnique({ where: { id: entitlement_id } })
    if (!entitlement || entitlement.status !== SupportEntitlementStatus.ACTIVE) return
    if (entitlement.expiresAt.toISOString() !== expected_expiration) return

    const guild = await this.client.guilds.fetch(required_string(row.guildId, 'guild_id')).catch(() => null)
    if (!guild) throw new Error('support_guild_unavailable')
    await this.send_user_message(required_string(row.userId, 'user_id'), {
      content:
        `Seu apoio em **${guild.name}** expira em <t:${Math.floor(entitlement.expiresAt.getTime() / 1000)}:F>.\n` +
        'Use `/apoiar` no servidor se quiser renovar.',
      allowedMentions: { parse: [] },
    })

    await prisma.supportAuditEvent.create({
      data: {
        guildId: entitlement.guildId,
        userId: entitlement.userId,
        action: 'support.reminder_sent',
        metadata: { roleId: entitlement.roleId },
      },
    })
  }

  private async deliver_support_role_remove(payload: Record<string, unknown>) {
    const entitlement_id = required_string(payload.entitlementId, 'entitlement_id')
    const entitlement = await prisma.supportEntitlement.findUnique({ where: { id: entitlement_id } })
    if (!entitlement) return

    if (entitlement.status === SupportEntitlementStatus.ACTIVE && entitlement.expiresAt.getTime() > Date.now()) {
      return
    }

    const guild = await this.client.guilds.fetch(entitlement.guildId).catch(() => null)
    if (!guild) throw new Error('support_guild_unavailable')
    const member = await guild.members.fetch(entitlement.userId).catch(() => null)
    if (!member) {
      await prisma.supportEntitlement.update({
        where: { id: entitlement.id },
        data: { roleSyncStatus: SupportRoleSyncStatus.SYNCED, lastRoleSyncAt: new Date() },
      })
      return
    }

    if (member.roles.cache.has(entitlement.roleId)) {
      await member.roles.remove(entitlement.roleId, 'Yue support entitlement ended')
    }
    await prisma.supportEntitlement.update({
      where: { id: entitlement.id },
      data: { roleSyncStatus: SupportRoleSyncStatus.SYNCED, lastRoleSyncAt: new Date() },
    })
  }
}
