import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js'
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildMember,
  InteractionEditReplyOptions,
  Role,
  StringSelectMenuInteraction,
} from 'discord.js'
import {
  decrypt_livepix_secret,
  encrypt_livepix_secret,
  LivePixApiError,
  LivePixClient,
  LivePixClientCredentialsTokenCache,
  LIVEPIX_REQUIRED_SCOPES,
} from '@yuebot/livepix'
import {
  LivePixConnectionMode,
  LivePixConnectionStatus,
  Prisma,
  SupportEntitlementStatus,
  SupportPaymentStatus,
  SupportRoleSyncStatus,
  prisma,
} from '@yuebot/database'
import type { LivePixConnection, SupportEntitlement, SupportPayment } from '@yuebot/database'
import { COLORS, EMOJIS, generate_public_id } from '@yuebot/shared'
import { CONFIG } from '../../config'
import { logger } from '../../utils/logger'
import { safe_error_details } from '../../utils/safe_error'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction'

const SUPPORT_CUSTOM_ID_PREFIX = 'support:'
const SUPPORT_PENDING_WINDOW_MS = 15 * 60 * 1000
const SUPPORT_CHECKOUT_REUSE_MAX_AGE_MS = 24 * 60 * 60 * 1000

type support_role_validation = {
  valid: boolean
  reason: string | null
  role: {
    id: string
    name: string
    color: number
    position: number
    managed: boolean
  } | null
}

type payment_verification_result = {
  success: true
  status: 'pending' | 'fulfilled' | 'already_fulfilled' | 'role_sync_failed' | 'mismatch' | 'connection_error'
  message: string
  checkoutUrl?: string
  expiresAt?: Date
}

type entitlement_sync_result = {
  success: true
  status: 'synced' | 'removed' | 'failed' | 'not_found'
}

class SupportFlowError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'SupportFlowError'
  }
}

function format_money(amount_cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount_cents / 100)
}

function add_days(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function truncate_for_discord(value: string, max: number) {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(0, max - 3))}...`
}

function payment_pending_key(guild_id: string, user_id: string, plan_id: string) {
  return `${guild_id}:${user_id}:${plan_id}`
}

function component_user_id(custom_id: string, prefix: string) {
  const raw = custom_id.slice(prefix.length)
  const [user_id] = raw.split(':')
  return user_id ?? ''
}

function is_payment_final(status: SupportPaymentStatus) {
  const final_statuses: SupportPaymentStatus[] = [
    SupportPaymentStatus.FULFILLED,
    SupportPaymentStatus.FAILED,
    SupportPaymentStatus.MISMATCH,
    SupportPaymentStatus.CANCELLED,
    SupportPaymentStatus.EXPIRED,
  ]
  return final_statuses.includes(status)
}

async function fetch_member(guild: Guild, user_id: string) {
  return await guild.members.fetch(user_id).catch(() => null)
}

function role_payload(role: Role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
    managed: role.managed,
  }
}

export class SupportService {
  private readonly livepixClient = new LivePixClient()
  private ownerTokenCache: LivePixClientCredentialsTokenCache | null = null

  async validate_support_role(guild: Guild, role_id: string): Promise<support_role_validation> {
    const role = await guild.roles.fetch(role_id).catch(() => null)
    if (!role) return { valid: false, reason: 'Role not found', role: null }
    if (role.id === guild.roles.everyone.id) return { valid: false, reason: 'The @everyone role cannot be used', role: role_payload(role) }
    if (role.managed) return { valid: false, reason: 'Managed roles cannot be assigned by the bot', role: role_payload(role) }

    const me = await guild.members.fetchMe().catch(() => null)
    if (!me) return { valid: false, reason: 'Bot member not found', role: role_payload(role) }
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return { valid: false, reason: 'Bot lacks Manage Roles permission', role: role_payload(role) }
    }

    if (role.position >= me.roles.highest.position) {
      return { valid: false, reason: 'Role must be below the bot highest role', role: role_payload(role) }
    }

    return { valid: true, reason: null, role: role_payload(role) }
  }

  async handle_command(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Use este comando em um servidor.` })
      return
    }

    await safe_defer_ephemeral(interaction)
    const payload = await this.build_home_payload(interaction.guild, interaction.user.id)
    await interaction.editReply(payload)
  }

  async handle_plan_select(interaction: StringSelectMenuInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Use isso em um servidor.` })
      return
    }

    const expected_user_id = component_user_id(interaction.customId, 'support:plan:')
    if (expected_user_id !== interaction.user.id) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Esta seleção não pertence a você.` })
      return
    }

    const plan_id = interaction.values[0]
    if (!plan_id) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Plano inválido.` })
      return
    }

    await interaction.deferUpdate()
    const payload = await this.build_plan_details_payload(interaction.guild, interaction.user.id, plan_id)
    await interaction.editReply(payload)
  }

  async handle_button(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Use isso em um servidor.` })
      return
    }

    if (interaction.customId.startsWith('support:back:')) {
      const expected_user_id = component_user_id(interaction.customId, 'support:back:')
      if (expected_user_id !== interaction.user.id) {
        await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Este botão não pertence a você.` })
        return
      }

      await interaction.deferUpdate()
      const payload = await this.build_home_payload(interaction.guild, interaction.user.id)
      await interaction.editReply(payload)
      return
    }

    if (interaction.customId.startsWith('support:pay:')) {
      await this.handle_pay_button(interaction)
      return
    }

    if (interaction.customId.startsWith('support:verify:')) {
      await this.handle_verify_button(interaction)
    }
  }

  async verify_and_fulfill_payment(client: Client, guild_id: string, payment_id: string): Promise<payment_verification_result> {
    const payment = await prisma.supportPayment.findUnique({ where: { id: payment_id } })
    if (!payment || payment.guildId !== guild_id) {
      return { success: true, status: 'pending', message: 'Pagamento não encontrado.' }
    }

    if (payment.status === SupportPaymentStatus.FULFILLED) {
      return { success: true, status: 'already_fulfilled', message: 'Pagamento já processado.' }
    }

    if (payment.status === SupportPaymentStatus.MISMATCH) {
      return { success: true, status: 'mismatch', message: 'Pagamento confirmado com dados divergentes.' }
    }

    const connection = await prisma.livePixConnection.findUnique({ where: { guildId: payment.guildId } })
    if (!connection || connection.providerAccountId !== payment.providerAccountId) {
      await prisma.supportPayment.update({
        where: { id: payment.id },
        data: { failureCode: 'connection_mismatch' },
      })
      return { success: true, status: 'connection_error', message: 'Conexão LivePix indisponível para este pagamento.' }
    }

    let access_token: string
    try {
      access_token = await this.get_access_token(connection)
    } catch (error) {
      await prisma.supportPayment.update({
        where: { id: payment.id },
        data: { failureCode: error instanceof SupportFlowError ? error.code : 'connection_error' },
      })
      return { success: true, status: 'connection_error', message: 'A conexão LivePix precisa ser reconectada.' }
    }

    let provider_payment: { id: string; reference: string; amount: number; currency: string; createdAt: string | null } | null
    try {
      provider_payment = payment.livePixPaymentId
        ? await this.livepixClient.getPayment(access_token, payment.livePixPaymentId)
        : await this.livepixClient.findPaymentByReference(access_token, payment.livePixReference)
    } catch (error) {
      if (error instanceof LivePixApiError && error.status === 404) {
        provider_payment = null
      } else {
        throw error
      }
    }

    if (!provider_payment) {
      await prisma.supportPayment.update({
        where: { id: payment.id },
        data: {
          status: payment.status === SupportPaymentStatus.CREATING ? SupportPaymentStatus.PENDING : payment.status,
          lastVerifiedAt: new Date(),
        },
      })
      return { success: true, status: 'pending', message: 'O pagamento ainda não foi confirmado pela LivePix.' }
    }

    const mismatch_code = this.get_payment_mismatch_code(payment, provider_payment)
    if (mismatch_code) {
      await prisma.supportPayment.update({
        where: { id: payment.id },
        data: {
          status: SupportPaymentStatus.MISMATCH,
          roleSyncStatus: SupportRoleSyncStatus.FAILED,
          mismatchCode: mismatch_code,
          livePixPaymentId: provider_payment.id,
          lastVerifiedAt: new Date(),
        },
      })
      await this.audit(payment.guildId, payment.userId, payment.id, 'support.payment_mismatch', { code: mismatch_code })
      return { success: true, status: 'mismatch', message: 'Pagamento confirmado com dados divergentes. Nenhum cargo foi concedido.' }
    }

    const fulfilled = await this.fulfill_payment_once(payment.id, provider_payment.id, provider_payment.createdAt)
    const guild = await client.guilds.fetch(payment.guildId).catch(() => null)
    if (!guild) {
      await this.mark_role_sync_failed(fulfilled.entitlementId, payment.id, 'guild_not_found')
      return { success: true, status: 'role_sync_failed', message: 'Pagamento confirmado, mas o servidor não foi encontrado.' }
    }

    const sync_result = await this.sync_entitlement_role(client, fulfilled.entitlementId)
    if (sync_result.status !== 'synced') {
      return {
        success: true,
        status: 'role_sync_failed',
        message: 'Pagamento confirmado, mas ainda não consegui sincronizar o cargo.',
        expiresAt: fulfilled.expiresAt,
      }
    }

    await this.send_payment_dm(client, guild, payment.userId, fulfilled.expiresAt).catch((error) => {
      logger.info({ err: safe_error_details(error), guildId: guild.id }, 'Support payment DM could not be delivered')
    })

    return {
      success: true,
      status: fulfilled.alreadyFulfilled ? 'already_fulfilled' : 'fulfilled',
      message: fulfilled.alreadyFulfilled ? 'Pagamento já processado.' : 'Pagamento confirmado e cargo sincronizado.',
      expiresAt: fulfilled.expiresAt,
    }
  }

  async sync_entitlement_role(client: Client, entitlement_id: string): Promise<entitlement_sync_result> {
    const entitlement = await prisma.supportEntitlement.findUnique({ where: { id: entitlement_id } })
    if (!entitlement) return { success: true, status: 'not_found' }

    if (entitlement.status === SupportEntitlementStatus.REVOKED || entitlement.status === SupportEntitlementStatus.EXPIRED) {
      return await this.remove_entitlement_role(client, entitlement_id)
    }

    if (entitlement.expiresAt.getTime() <= Date.now()) {
      await prisma.supportEntitlement.update({
        where: { id: entitlement.id },
        data: { status: SupportEntitlementStatus.EXPIRED, roleSyncStatus: SupportRoleSyncStatus.PENDING },
      })
      return await this.remove_entitlement_role(client, entitlement_id)
    }

    const guild = await client.guilds.fetch(entitlement.guildId).catch(() => null)
    if (!guild) {
      await this.mark_entitlement_sync_failed(entitlement.id, 'guild_not_found')
      return { success: true, status: 'failed' }
    }

    const member = await fetch_member(guild, entitlement.userId)
    if (!member) {
      await prisma.supportEntitlement.update({
        where: { id: entitlement.id },
        data: { roleSyncStatus: SupportRoleSyncStatus.PENDING, lastRoleSyncAt: new Date() },
      })
      return { success: true, status: 'failed' }
    }

    const validation = await this.validate_support_role(guild, entitlement.roleId)
    if (!validation.valid) {
      await this.mark_entitlement_sync_failed(entitlement.id, validation.reason ?? 'role_not_manageable')
      return { success: true, status: 'failed' }
    }

    try {
      await member.roles.add(entitlement.roleId, 'Yue support entitlement')
      await prisma.supportEntitlement.update({
        where: { id: entitlement.id },
        data: { roleSyncStatus: SupportRoleSyncStatus.SYNCED, lastRoleSyncAt: new Date() },
      })
      await prisma.supportPayment.updateMany({
        where: {
          guildId: entitlement.guildId,
          userId: entitlement.userId,
          roleIdSnapshot: entitlement.roleId,
          status: SupportPaymentStatus.FULFILLED,
          roleSyncStatus: SupportRoleSyncStatus.PENDING,
        },
        data: { roleSyncStatus: SupportRoleSyncStatus.SYNCED },
      })
      return { success: true, status: 'synced' }
    } catch (error) {
      logger.warn({ err: safe_error_details(error), guildId: entitlement.guildId }, 'Failed to add support role')
      await this.mark_entitlement_sync_failed(entitlement.id, 'discord_role_add_failed')
      await prisma.supportPayment.updateMany({
        where: {
          guildId: entitlement.guildId,
          userId: entitlement.userId,
          roleIdSnapshot: entitlement.roleId,
          status: SupportPaymentStatus.FULFILLED,
          roleSyncStatus: SupportRoleSyncStatus.PENDING,
        },
        data: { roleSyncStatus: SupportRoleSyncStatus.FAILED },
      })
      return { success: true, status: 'failed' }
    }
  }

  async remove_entitlement_role(client: Client, entitlement_id: string): Promise<entitlement_sync_result> {
    const entitlement = await prisma.supportEntitlement.findUnique({ where: { id: entitlement_id } })
    if (!entitlement) return { success: true, status: 'not_found' }

    const guild = await client.guilds.fetch(entitlement.guildId).catch(() => null)
    if (!guild) {
      await this.mark_entitlement_sync_failed(entitlement.id, 'guild_not_found')
      return { success: true, status: 'failed' }
    }

    const member = await fetch_member(guild, entitlement.userId)
    if (!member) {
      await prisma.supportEntitlement.update({
        where: { id: entitlement.id },
        data: { roleSyncStatus: SupportRoleSyncStatus.SYNCED, lastRoleSyncAt: new Date() },
      })
      return { success: true, status: 'removed' }
    }

    try {
      if (member.roles.cache.has(entitlement.roleId)) {
        await member.roles.remove(entitlement.roleId, 'Yue support entitlement ended')
      }
      await prisma.supportEntitlement.update({
        where: { id: entitlement.id },
        data: { roleSyncStatus: SupportRoleSyncStatus.SYNCED, lastRoleSyncAt: new Date() },
      })
      return { success: true, status: 'removed' }
    } catch (error) {
      logger.warn({ err: safe_error_details(error), guildId: entitlement.guildId }, 'Failed to remove support role')
      await this.mark_entitlement_sync_failed(entitlement.id, 'discord_role_remove_failed')
      return { success: true, status: 'failed' }
    }
  }

  async restore_member_entitlements(member: GuildMember) {
    const entitlements = await prisma.supportEntitlement.findMany({
      where: {
        guildId: member.guild.id,
        userId: member.id,
        status: SupportEntitlementStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    })

    for (const entitlement of entitlements) {
      await this.sync_entitlement_role(member.client, entitlement.id)
    }
  }

  async run_expiration_batch(client: Client) {
    const expired = await prisma.supportEntitlement.findMany({
      where: {
        status: SupportEntitlementStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
      take: 50,
      orderBy: { expiresAt: 'asc' },
    })

    for (const entitlement of expired) {
      await prisma.supportEntitlement.update({
        where: { id: entitlement.id },
        data: { status: SupportEntitlementStatus.EXPIRED, roleSyncStatus: SupportRoleSyncStatus.PENDING },
      })
      await this.remove_entitlement_role(client, entitlement.id)
      await this.audit(entitlement.guildId, entitlement.userId, null, 'support.entitlement_expired', { roleId: entitlement.roleId })
    }
  }

  async run_reminder_batch(client: Client) {
    const configs = await prisma.guildSupportConfig.findMany({
      where: { enabled: true, reminderEnabled: true },
      select: { guildId: true, reminderDaysBefore: true },
    })

    for (const config of configs) {
      const now = new Date()
      const window_start = add_days(now, Math.max(1, config.reminderDaysBefore) - 1)
      const window_end = add_days(now, Math.max(1, config.reminderDaysBefore))
      const entitlements = await prisma.supportEntitlement.findMany({
        where: {
          guildId: config.guildId,
          status: SupportEntitlementStatus.ACTIVE,
          expiresAt: { gte: window_start, lte: window_end },
          OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: window_start } }],
        },
        take: 25,
      })

      for (const entitlement of entitlements) {
        const guild = await client.guilds.fetch(entitlement.guildId).catch(() => null)
        if (!guild) continue

        const sent = await this.send_expiration_reminder_dm(client, guild, entitlement).catch((error) => {
          logger.info({ err: safe_error_details(error), guildId: guild.id }, 'Support reminder DM could not be delivered')
          return false
        })

        await prisma.supportEntitlement.update({
          where: { id: entitlement.id },
          data: { lastReminderAt: new Date() },
        })

        if (sent) {
          await this.audit(entitlement.guildId, entitlement.userId, null, 'support.reminder_sent', { roleId: entitlement.roleId })
        }
      }
    }
  }

  private async handle_pay_button(interaction: ButtonInteraction) {
    if (!interaction.guild) return
    const parts = interaction.customId.split(':')
    const expected_user_id = parts[2]
    const plan_id = parts[3]
    if (expected_user_id !== interaction.user.id) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Este botão não pertence a você.` })
      return
    }
    if (!plan_id) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Plano inválido.` })
      return
    }

    await interaction.deferUpdate()

    try {
      const checkout = await this.create_checkout(interaction.guild, interaction.user.id, plan_id)
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('Pagamento Pix')
        .setDescription(
          `${checkout.reused ? 'Reutilizei um checkout pendente para este plano.' : 'Checkout criado com segurança.'}\n\n` +
          'Abra o pagamento pelo botão abaixo. O cargo só será concedido depois da confirmação da LivePix.'
        )

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(checkout.checkoutUrl).setLabel('Abrir LivePix'),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(`support:verify:${interaction.user.id}:${checkout.publicId}`)
          .setLabel('Verificar pagamento')
      )

      await interaction.editReply({ embeds: [embed], components: [row], content: null, allowedMentions: { parse: [] } })
    } catch (error) {
      const message = error instanceof SupportFlowError ? error.message : 'Não consegui criar o checkout agora.'
      await interaction.editReply({
        content: `${EMOJIS.ERROR} ${message}`,
        embeds: [],
        components: [],
        allowedMentions: { parse: [] },
      })
    }
  }

  private async handle_verify_button(interaction: ButtonInteraction) {
    if (!interaction.guild) return
    const parts = interaction.customId.split(':')
    const expected_user_id = parts[2]
    const public_id = parts[3]

    if (expected_user_id !== interaction.user.id) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Este botão não pertence a você.` })
      return
    }
    if (!public_id) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Pagamento inválido.` })
      return
    }

    await interaction.deferUpdate()
    const payment = await prisma.supportPayment.findUnique({ where: { publicId: public_id } })
    if (!payment || payment.guildId !== interaction.guild.id || payment.userId !== interaction.user.id) {
      await interaction.editReply({
        content: `${EMOJIS.ERROR} Este pagamento não pertence a você.`,
        embeds: [],
        components: [],
        allowedMentions: { parse: [] },
      })
      return
    }

    const result = await this.verify_and_fulfill_payment(interaction.client, interaction.guild.id, payment.id)
    const color =
      result.status === 'fulfilled' || result.status === 'already_fulfilled'
        ? COLORS.SUCCESS
        : result.status === 'pending'
          ? COLORS.INFO
          : COLORS.WARNING

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('Status do pagamento')
      .setDescription(
        result.expiresAt
          ? `${result.message}\n\nExpira em: <t:${Math.floor(result.expiresAt.getTime() / 1000)}:F>`
          : result.message
      )

    const components: ActionRowBuilder<ButtonBuilder>[] = []
    if (result.status === 'pending') {
      const checkout_url = payment.checkoutUrlEncrypted
        ? decrypt_livepix_secret(payment.checkoutUrlEncrypted, CONFIG.livePix.tokenEncryptionKey)
        : null
      const row = new ActionRowBuilder<ButtonBuilder>()
      if (checkout_url) {
        row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(checkout_url).setLabel('Abrir LivePix'))
      }
      row.addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(`support:verify:${interaction.user.id}:${payment.publicId}`)
          .setLabel('Verificar pagamento')
      )
      components.push(row)
    }

    await interaction.editReply({ embeds: [embed], components, content: null, allowedMentions: { parse: [] } })
  }

  private async build_home_payload(guild: Guild, user_id: string): Promise<InteractionEditReplyOptions> {
    const config = await prisma.guildSupportConfig.findUnique({ where: { guildId: guild.id } })
    if (!config?.enabled) {
      return { content: `${EMOJIS.INFO} Apoios não estão habilitados neste servidor.`, embeds: [], components: [] }
    }

    const connection = await prisma.livePixConnection.findUnique({ where: { guildId: guild.id } })
    if (!connection || connection.status !== LivePixConnectionStatus.CONNECTED) {
      return { content: `${EMOJIS.ERROR} A conexão LivePix deste servidor precisa ser configurada.`, embeds: [], components: [] }
    }

    const plans = await this.get_active_plans(guild.id)
    if (plans.length === 0) {
      return { content: `${EMOJIS.INFO} Nenhum plano de apoio está disponível no momento.`, embeds: [], components: [] }
    }

    for (const plan of plans) {
      const validation = await this.validate_support_role(guild, plan.roleId)
      if (!validation.valid) {
        return { content: `${EMOJIS.ERROR} Um plano está com cargo inválido. Avise a administração.`, embeds: [], components: [] }
      }
    }

    const entitlements = await prisma.supportEntitlement.findMany({
      where: {
        guildId: guild.id,
        userId: user_id,
        status: SupportEntitlementStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'asc' },
    })

    const entitlement_text = entitlements.length
      ? entitlements
          .map((entitlement) => `<@&${entitlement.roleId}> até <t:${Math.floor(entitlement.expiresAt.getTime() / 1000)}:D>`)
          .join('\n')
      : 'Você não tem apoios ativos neste servidor.'

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(truncate_for_discord(config.title, 256))
      .setDescription(truncate_for_discord(config.description, 3500))
      .addFields({ name: 'Seus apoios ativos', value: entitlement_text })

    const select = new StringSelectMenuBuilder()
      .setCustomId(`support:plan:${user_id}`)
      .setPlaceholder('Selecione um plano')
      .addOptions(
        plans.map((plan) => ({
          label: truncate_for_discord(plan.name, 100),
          description: truncate_for_discord(`${format_money(plan.amountCents)} • ${plan.durationDays} dia(s)`, 100),
          value: plan.id,
        }))
      )

    return {
      content: null,
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      allowedMentions: { parse: [] },
    }
  }

  private async build_plan_details_payload(guild: Guild, user_id: string, plan_id: string): Promise<InteractionEditReplyOptions> {
    const plan = await prisma.supportPlan.findUnique({ where: { id: plan_id } })
    if (!plan || plan.guildId !== guild.id || plan.archivedAt || !plan.enabled) {
      return { content: `${EMOJIS.ERROR} Este plano não está disponível.`, embeds: [], components: [], allowedMentions: { parse: [] } }
    }

    const entitlement = await prisma.supportEntitlement.findUnique({
      where: {
        guildId_userId_roleId: {
          guildId: guild.id,
          userId: user_id,
          roleId: plan.roleId,
        },
      },
    })

    const current_expiration =
      entitlement?.status === SupportEntitlementStatus.ACTIVE && entitlement.expiresAt.getTime() > Date.now()
        ? `\nApoio atual expira em: <t:${Math.floor(entitlement.expiresAt.getTime() / 1000)}:F>`
        : ''

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(truncate_for_discord(plan.name, 256))
      .setDescription(
        `${truncate_for_discord(plan.description, 3000)}\n\n` +
        `Valor: **${format_money(plan.amountCents)}**\n` +
        `Duração: **${plan.durationDays} dia(s)**\n` +
        `Cargo: <@&${plan.roleId}>` +
        current_expiration +
        '\n\nUm pagamento confirmado adiciona ou estende este cargo.'
      )

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`support:pay:${user_id}:${plan.id}`).setLabel('Pagar com Pix'),
      new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`support:back:${user_id}`).setLabel('Voltar')
    )

    return { content: null, embeds: [embed], components: [row], allowedMentions: { parse: [] } }
  }

  private async get_active_plans(guild_id: string) {
    return await prisma.supportPlan.findMany({
      where: { guildId: guild_id, archivedAt: null, enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 25,
    })
  }

  private async create_checkout(guild: Guild, user_id: string, plan_id: string) {
    if (!CONFIG.livePix.enabled) {
      throw new SupportFlowError('livepix_disabled', 'LivePix não está configurado nesta instalação.')
    }

    const plan = await prisma.supportPlan.findUnique({ where: { id: plan_id } })
    if (!plan || plan.guildId !== guild.id || plan.archivedAt || !plan.enabled) {
      throw new SupportFlowError('plan_unavailable', 'Este plano não está disponível.')
    }

    const config = await prisma.guildSupportConfig.findUnique({ where: { guildId: guild.id } })
    if (!config?.enabled) {
      throw new SupportFlowError('module_disabled', 'Apoios não estão habilitados neste servidor.')
    }

    const validation = await this.validate_support_role(guild, plan.roleId)
    if (!validation.valid) {
      throw new SupportFlowError('role_not_manageable', 'O cargo configurado não pode ser gerenciado pelo bot.')
    }

    const connection = await prisma.livePixConnection.findUnique({ where: { guildId: guild.id } })
    if (!connection || connection.status !== LivePixConnectionStatus.CONNECTED) {
      throw new SupportFlowError('connection_unavailable', 'A conexão LivePix deste servidor precisa ser reconectada.')
    }

    const pending_key = payment_pending_key(guild.id, user_id, plan.id)
    const existing = await prisma.supportPayment.findFirst({
      where: {
        pendingKey: pending_key,
        guildId: guild.id,
        userId: user_id,
        planId: plan.id,
        status: { in: [SupportPaymentStatus.CREATING, SupportPaymentStatus.PENDING] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (existing?.checkoutUrlEncrypted && existing.createdAt.getTime() >= Date.now() - SUPPORT_CHECKOUT_REUSE_MAX_AGE_MS) {
      return {
        publicId: existing.publicId,
        checkoutUrl: decrypt_livepix_secret(existing.checkoutUrlEncrypted, CONFIG.livePix.tokenEncryptionKey),
        reused: true,
      }
    }

    if (existing && existing.createdAt.getTime() >= Date.now() - SUPPORT_PENDING_WINDOW_MS) {
      throw new SupportFlowError('checkout_in_progress', 'Um checkout para este plano já está sendo criado. Tente novamente em alguns instantes.')
    }

    if (existing && !is_payment_final(existing.status)) {
      await prisma.supportPayment.update({
        where: { id: existing.id },
        data: { status: SupportPaymentStatus.EXPIRED, pendingKey: null, failureCode: 'local_stale_checkout' },
      })
    }

    const access_token = await this.get_access_token(connection)
    const public_id = generate_public_id(18)
    const placeholder_reference = `creating:${public_id}`

    const payment = await prisma.supportPayment.create({
      data: {
        publicId: public_id,
        guildId: guild.id,
        userId: user_id,
        planId: plan.id,
        livePixConnectionId: connection.id,
        providerAccountId: connection.providerAccountId,
        livePixReference: placeholder_reference,
        pendingKey: pending_key,
        planNameSnapshot: plan.name,
        planDescriptionSnapshot: plan.description,
        amountCentsSnapshot: plan.amountCents,
        durationDaysSnapshot: plan.durationDays,
        roleIdSnapshot: plan.roleId,
        currency: 'BRL',
        status: SupportPaymentStatus.CREATING,
      },
    })

    try {
      const checkout = await this.livepixClient.createPayment(access_token, {
        amount: plan.amountCents,
        currency: 'BRL',
        redirectUrl: CONFIG.livePix.paymentReturnUrl,
      })

      await prisma.supportPayment.update({
        where: { id: payment.id },
        data: {
          livePixReference: checkout.reference,
          checkoutUrlEncrypted: encrypt_livepix_secret(checkout.redirectUrl, CONFIG.livePix.tokenEncryptionKey),
          status: SupportPaymentStatus.PENDING,
        },
      })

      await this.audit(guild.id, user_id, payment.id, 'support.checkout_created', {
        planId: plan.id,
        amountCents: plan.amountCents,
      })

      return { publicId: public_id, checkoutUrl: checkout.redirectUrl, reused: false }
    } catch (error) {
      await prisma.supportPayment.update({
        where: { id: payment.id },
        data: {
          status: SupportPaymentStatus.FAILED,
          pendingKey: null,
          failureCode: error instanceof LivePixApiError ? error.code : 'checkout_creation_failed',
        },
      })
      throw error
    }
  }

  private get_payment_mismatch_code(
    payment: SupportPayment,
    provider_payment: { reference: string; amount: number; currency: string }
  ): string | null {
    if (provider_payment.reference !== payment.livePixReference) return 'reference_mismatch'
    if (provider_payment.currency !== 'BRL' || provider_payment.currency !== payment.currency) return 'currency_mismatch'
    if (provider_payment.amount !== payment.amountCentsSnapshot) return 'amount_mismatch'
    return null
  }

  private async fulfill_payment_once(payment_id: string, provider_payment_id: string, provider_created_at: string | null) {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment_id}))`

      const payment = await tx.supportPayment.findUnique({ where: { id: payment_id } })
      if (!payment) {
        throw new SupportFlowError('payment_not_found', 'Pagamento não encontrado.')
      }

      const existing_entitlement = await tx.supportEntitlement.findUnique({
        where: {
          guildId_userId_roleId: {
            guildId: payment.guildId,
            userId: payment.userId,
            roleId: payment.roleIdSnapshot,
          },
        },
      })

      if (payment.status === SupportPaymentStatus.FULFILLED && existing_entitlement) {
        return {
          entitlementId: existing_entitlement.id,
          expiresAt: existing_entitlement.expiresAt,
          alreadyFulfilled: true,
        }
      }

      const now = new Date()
      const base =
        existing_entitlement?.status === SupportEntitlementStatus.ACTIVE && existing_entitlement.expiresAt.getTime() > now.getTime()
          ? existing_entitlement.expiresAt
          : now
      const expires_at = add_days(base, payment.durationDaysSnapshot)

      const entitlement = await tx.supportEntitlement.upsert({
        where: {
          guildId_userId_roleId: {
            guildId: payment.guildId,
            userId: payment.userId,
            roleId: payment.roleIdSnapshot,
          },
        },
        update: {
          latestPlanId: payment.planId,
          status: SupportEntitlementStatus.ACTIVE,
          expiresAt: expires_at,
          revokedAt: null,
          revokedReason: null,
          roleSyncStatus: SupportRoleSyncStatus.PENDING,
        },
        create: {
          guildId: payment.guildId,
          userId: payment.userId,
          roleId: payment.roleIdSnapshot,
          latestPlanId: payment.planId,
          status: SupportEntitlementStatus.ACTIVE,
          startsAt: now,
          expiresAt: expires_at,
          roleSyncStatus: SupportRoleSyncStatus.PENDING,
        },
      })

      await tx.supportPayment.update({
        where: { id: payment.id },
        data: {
          livePixPaymentId: provider_payment_id,
          providerCreatedAt: provider_created_at ? new Date(provider_created_at) : null,
          status: SupportPaymentStatus.FULFILLED,
          roleSyncStatus: SupportRoleSyncStatus.PENDING,
          confirmedAt: payment.confirmedAt ?? now,
          fulfilledAt: payment.fulfilledAt ?? now,
          lastVerifiedAt: now,
          pendingKey: null,
        },
      })

      await tx.supportAuditEvent.create({
        data: {
          guildId: payment.guildId,
          userId: payment.userId,
          supportPaymentId: payment.id,
          action: 'support.payment_fulfilled',
          metadata: {
            roleId: payment.roleIdSnapshot,
            amountCents: payment.amountCentsSnapshot,
            durationDays: payment.durationDaysSnapshot,
          },
        },
      })

      return { entitlementId: entitlement.id, expiresAt: entitlement.expiresAt, alreadyFulfilled: false }
    })
  }

  private async get_access_token(connection: LivePixConnection) {
    if (connection.status !== LivePixConnectionStatus.CONNECTED) {
      throw new SupportFlowError('connection_unavailable', 'Conexão LivePix indisponível.')
    }

    if (connection.mode === LivePixConnectionMode.OWNER) {
      if (!CONFIG.livePix.ownerGuildIds.includes(connection.guildId)) {
        throw new SupportFlowError('owner_guild_not_allowed', 'Owner LivePix mode is not allowed for this guild.')
      }
      return await this.get_owner_token_cache().getAccessToken()
    }

    if (!connection.encryptedAccessToken) {
      throw new SupportFlowError('missing_access_token', 'Conexão LivePix precisa ser refeita.')
    }

    if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() <= Date.now()) {
      await prisma.livePixConnection.update({
        where: { id: connection.id },
        data: { status: LivePixConnectionStatus.REAUTH_REQUIRED, lastErrorCode: 'token_expired' },
      })
      throw new SupportFlowError('token_expired', 'Conexão LivePix expirada. Reconecte no painel.')
    }

    return decrypt_livepix_secret(connection.encryptedAccessToken, CONFIG.livePix.tokenEncryptionKey)
  }

  private get_owner_token_cache() {
    if (!this.ownerTokenCache) {
      this.ownerTokenCache = new LivePixClientCredentialsTokenCache(this.livepixClient, {
        clientId: CONFIG.livePix.clientId,
        clientSecret: CONFIG.livePix.clientSecret,
        scopes: LIVEPIX_REQUIRED_SCOPES,
      })
    }

    return this.ownerTokenCache
  }

  private async mark_role_sync_failed(entitlement_id: string, payment_id: string, reason: string) {
    await Promise.all([
      this.mark_entitlement_sync_failed(entitlement_id, reason),
      prisma.supportPayment.update({
        where: { id: payment_id },
        data: { roleSyncStatus: SupportRoleSyncStatus.FAILED, failureCode: reason },
      }),
    ])
  }

  private async mark_entitlement_sync_failed(entitlement_id: string, reason: string) {
    await prisma.supportEntitlement.update({
      where: { id: entitlement_id },
      data: { roleSyncStatus: SupportRoleSyncStatus.FAILED, lastRoleSyncAt: new Date() },
    })
    const entitlement = await prisma.supportEntitlement.findUnique({ where: { id: entitlement_id } })
    if (entitlement) {
      await this.audit(entitlement.guildId, entitlement.userId, null, 'support.role_sync_failed', { roleId: entitlement.roleId, reason })
    }
  }

  private async send_payment_dm(client: Client, guild: Guild, user_id: string, expires_at: Date) {
    const user = await client.users.fetch(user_id)
    await user.send({
      content:
        `Seu pagamento em **${guild.name}** foi confirmado e o cargo foi atualizado.\n` +
        `Expira em: <t:${Math.floor(expires_at.getTime() / 1000)}:F>`,
      allowedMentions: { parse: [] },
    })
  }

  private async send_expiration_reminder_dm(client: Client, guild: Guild, entitlement: SupportEntitlement) {
    const user = await client.users.fetch(entitlement.userId)
    await user.send({
      content:
        `Seu apoio em **${guild.name}** expira em <t:${Math.floor(entitlement.expiresAt.getTime() / 1000)}:F>.\n` +
        'Use `/apoiar` no servidor se quiser renovar.',
      allowedMentions: { parse: [] },
    })
    return true
  }

  private async audit(guild_id: string, user_id: string | null, payment_id: string | null, action: string, metadata: Record<string, unknown>) {
    await prisma.supportAuditEvent.create({
      data: {
        guildId: guild_id,
        userId: user_id,
        supportPaymentId: payment_id,
        action,
        metadata: metadata as Prisma.InputJsonValue,
      },
    }).catch((error) => {
      logger.warn({ err: safe_error_details(error), guildId: guild_id, action }, 'Failed to write support audit event')
    })
  }
}

export const supportService = new SupportService()
export const supportCustomIdPrefix = SUPPORT_CUSTOM_ID_PREFIX
