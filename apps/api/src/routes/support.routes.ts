import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  supportConfigUpdateSchema,
  supportEntitlementListQuerySchema,
  supportEntitlementRevokeSchema,
  supportPaymentListQuerySchema,
  supportPlanCreateSchema,
  supportPlansReorderSchema,
  supportPlanUpdateSchema,
} from '@yuebot/shared'
import {
  LivePixConnectionStatus,
  SupportEntitlementStatus,
  SupportPaymentStatus,
  SupportRoleSyncStatus,
  prisma,
} from '@yuebot/database'
import { can_access_guild } from '../utils/guild_access'
import { validation_error_details } from '../utils/validation_error'
import { safe_error_details } from '../utils/safe_error'
import {
  is_guild_admin,
  remove_support_entitlement_role,
  sync_support_entitlement_role,
  validate_support_role,
  verify_and_fulfill_support_payment,
} from '../internal/bot_internal_api'
import {
  connect_livepix_owner_guild,
  create_livepix_oauth_authorization,
  disconnect_livepix_connection,
  serialize_livepix_connection,
  SupportApiError,
} from '../services/support/livepix_connections'
import { CONFIG } from '../config'

type authz_result =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false }

async function require_guild_admin(
  request: FastifyRequest,
  reply: FastifyReply,
  guildId: string
): Promise<authz_result> {
  const user = request.user

  if (!can_access_guild(user, guildId)) {
    await reply.code(403).send({ error: 'Forbidden' })
    return { ok: false }
  }

  const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { id: true } })
  if (!guild) {
    await reply.code(404).send({ error: 'Guild not found' })
    return { ok: false }
  }

  if (!user.isOwner) {
    const admin = await is_guild_admin(guildId, user.userId, request.log)
    if (!admin.isAdmin) {
      await reply.code(403).send({ error: 'Forbidden' })
      return { ok: false }
    }
  }

  return { ok: true, userId: user.userId, isOwner: user.isOwner }
}

function send_support_error(reply: FastifyReply, error: unknown) {
  if (error instanceof SupportApiError) {
    return reply.code(error.statusCode).send({ error: error.message })
  }

  return reply.code(500).send({ error: 'Internal server error' })
}

function serialize_config(config: {
  enabled: boolean
  title: string
  description: string
  reminderEnabled: boolean
  reminderDaysBefore: number
}) {
  return {
    enabled: config.enabled,
    title: config.title,
    description: config.description,
    reminderEnabled: config.reminderEnabled,
    reminderDaysBefore: config.reminderDaysBefore,
  }
}

function serialize_plan(plan: {
  id: string
  name: string
  description: string
  amountCents: number
  durationDays: number
  roleId: string
  enabled: boolean
  sortOrder: number
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    amountCents: plan.amountCents,
    durationDays: plan.durationDays,
    roleId: plan.roleId,
    enabled: plan.enabled,
    sortOrder: plan.sortOrder,
    archivedAt: plan.archivedAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}

function serialize_payment(payment: {
  id: string
  publicId: string
  userId: string
  planId: string | null
  providerAccountId: string
  livePixPaymentId: string | null
  planNameSnapshot: string
  amountCentsSnapshot: number
  durationDaysSnapshot: number
  roleIdSnapshot: string
  currency: string
  status: SupportPaymentStatus
  roleSyncStatus: SupportRoleSyncStatus
  confirmedAt: Date | null
  fulfilledAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: payment.id,
    publicId: payment.publicId,
    userId: payment.userId,
    planId: payment.planId,
    providerAccountId: payment.providerAccountId,
    livePixPaymentId: payment.livePixPaymentId,
    planNameSnapshot: payment.planNameSnapshot,
    amountCentsSnapshot: payment.amountCentsSnapshot,
    durationDaysSnapshot: payment.durationDaysSnapshot,
    roleIdSnapshot: payment.roleIdSnapshot,
    currency: payment.currency,
    status: payment.status,
    roleSyncStatus: payment.roleSyncStatus,
    confirmedAt: payment.confirmedAt?.toISOString() ?? null,
    fulfilledAt: payment.fulfilledAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}

function serialize_entitlement(entitlement: {
  id: string
  userId: string
  roleId: string
  latestPlanId: string | null
  status: SupportEntitlementStatus
  startsAt: Date
  expiresAt: Date
  lastReminderAt: Date | null
  lastRoleSyncAt: Date | null
  roleSyncStatus: SupportRoleSyncStatus
  revokedAt: Date | null
  revokedReason: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: entitlement.id,
    userId: entitlement.userId,
    roleId: entitlement.roleId,
    latestPlanId: entitlement.latestPlanId,
    status: entitlement.status,
    startsAt: entitlement.startsAt.toISOString(),
    expiresAt: entitlement.expiresAt.toISOString(),
    lastReminderAt: entitlement.lastReminderAt?.toISOString() ?? null,
    lastRoleSyncAt: entitlement.lastRoleSyncAt?.toISOString() ?? null,
    roleSyncStatus: entitlement.roleSyncStatus,
    revokedAt: entitlement.revokedAt?.toISOString() ?? null,
    revokedReason: entitlement.revokedReason,
    createdAt: entitlement.createdAt.toISOString(),
    updatedAt: entitlement.updatedAt.toISOString(),
  }
}

async function get_or_create_support_config(guildId: string) {
  return (
    (await prisma.guildSupportConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        title: true,
        description: true,
        reminderEnabled: true,
        reminderDaysBefore: true,
      },
    })) ??
    (await prisma.guildSupportConfig.create({
      data: { guildId },
      select: {
        enabled: true,
        title: true,
        description: true,
        reminderEnabled: true,
        reminderDaysBefore: true,
      },
    }))
  )
}

async function assert_plan_name_available(guildId: string, name: string, excludingPlanId?: string) {
  const active_plans = await prisma.supportPlan.findMany({
    where: {
      guildId,
      archivedAt: null,
      ...(excludingPlanId ? { id: { not: excludingPlanId } } : {}),
    },
    select: { name: true },
  })

  const normalized = name.trim().toLocaleLowerCase('pt-BR')
  if (active_plans.some((plan) => plan.name.trim().toLocaleLowerCase('pt-BR') === normalized)) {
    throw new SupportApiError(400, 'A support plan with this name already exists')
  }
}

async function assert_active_plan_limit(guildId: string, excludingPlanId?: string) {
  const count = await prisma.supportPlan.count({
    where: {
      guildId,
      archivedAt: null,
      enabled: true,
      ...(excludingPlanId ? { id: { not: excludingPlanId } } : {}),
    },
  })

  if (count >= 25) {
    throw new SupportApiError(400, 'A guild can have at most 25 active support plans')
  }
}

async function assert_role_manageable(guildId: string, roleId: string, request: FastifyRequest) {
  const role = await validate_support_role({ guildId, roleId }, request.log)
  if (!role.valid) {
    throw new SupportApiError(400, role.reason ?? 'Role cannot be managed by the bot')
  }
}

async function build_role_warnings(guildId: string, roleIds: string[], request: FastifyRequest) {
  const warnings: Array<{ roleId: string; reason: string }> = []

  for (const roleId of Array.from(new Set(roleIds)).slice(0, 25)) {
    try {
      const result = await validate_support_role({ guildId, roleId }, request.log)
      if (!result.valid) {
        warnings.push({ roleId, reason: result.reason ?? 'Role cannot be managed by the bot' })
      }
    } catch (error) {
      request.log.warn({ err: safe_error_details(error), guildId, roleId }, 'Failed to validate support role')
      warnings.push({ roleId, reason: 'Could not validate role manageability' })
    }
  }

  return warnings
}

export async function supportRoutes(fastify: FastifyInstance) {
  fastify.get('/:guildId/support', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const [config, connection, plans] = await Promise.all([
      get_or_create_support_config(guildId),
      prisma.livePixConnection.findUnique({ where: { guildId } }),
      prisma.supportPlan.findMany({
        where: { guildId },
        orderBy: [{ archivedAt: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ])

    const active_role_ids = plans
      .filter((plan) => plan.archivedAt === null && plan.enabled)
      .map((plan) => plan.roleId)

    const roleWarnings = await build_role_warnings(guildId, active_role_ids, request)

    return reply.send({
      success: true,
      config: serialize_config(config),
      connection: serialize_livepix_connection(connection),
      plans: plans.map(serialize_plan),
      ownerModeAllowed: CONFIG.livePix.ownerGuildIds.includes(guildId),
      livePixEnabled: CONFIG.livePix.enabled,
      roleWarnings,
    })
  })

  fastify.put('/:guildId/support/config', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const parsed = supportConfigUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const data = parsed.data
    const updated = await prisma.guildSupportConfig.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.reminderEnabled !== undefined ? { reminderEnabled: data.reminderEnabled } : {}),
        ...(data.reminderDaysBefore !== undefined ? { reminderDaysBefore: data.reminderDaysBefore } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        title: data.title ?? 'Apoios',
        description: data.description ?? 'Escolha um plano para apoiar este servidor.',
        reminderEnabled: data.reminderEnabled ?? true,
        reminderDaysBefore: data.reminderDaysBefore ?? 3,
      },
      select: {
        enabled: true,
        title: true,
        description: true,
        reminderEnabled: true,
        reminderDaysBefore: true,
      },
    })

    return reply.send({ success: true, config: serialize_config(updated) })
  })

  fastify.post('/:guildId/support/livepix/oauth/start', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    try {
      const result = await create_livepix_oauth_authorization({ guildId, userId: authz.userId })
      return reply.send({ success: true, authorizationUrl: result.authorizationUrl })
    } catch (error) {
      request.log.warn({ err: safe_error_details(error), guildId }, 'Failed to start LivePix OAuth')
      return send_support_error(reply, error)
    }
  })

  fastify.post('/:guildId/support/livepix/owner/connect', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    try {
      const connection = await connect_livepix_owner_guild({ guildId, userId: authz.userId })
      return reply.send({ success: true, connection })
    } catch (error) {
      request.log.warn({ err: safe_error_details(error), guildId }, 'Failed to connect owner LivePix account')
      return send_support_error(reply, error)
    }
  })

  fastify.post('/:guildId/support/livepix/disconnect', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const connection = await disconnect_livepix_connection(guildId)
    return reply.send({ success: true, connection })
  })

  fastify.get('/:guildId/support/plans', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const plans = await prisma.supportPlan.findMany({
      where: { guildId },
      orderBy: [{ archivedAt: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return reply.send({ success: true, plans: plans.map(serialize_plan) })
  })

  fastify.post('/:guildId/support/plans', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const parsed = supportPlanCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    try {
      const input = parsed.data
      if (input.enabled ?? true) await assert_active_plan_limit(guildId)
      await assert_plan_name_available(guildId, input.name)
      await assert_role_manageable(guildId, input.roleId, request)

      const plan = await prisma.supportPlan.create({
        data: {
          guildId,
          name: input.name,
          description: input.description,
          amountCents: input.amountCents,
          durationDays: input.durationDays,
          roleId: input.roleId,
          enabled: input.enabled ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      })

      return reply.code(201).send({ success: true, plan: serialize_plan(plan) })
    } catch (error) {
      request.log.warn({ err: safe_error_details(error), guildId }, 'Failed to create support plan')
      return send_support_error(reply, error)
    }
  })

  fastify.put('/:guildId/support/plans/:planId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, planId } = request.params as { guildId: string; planId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const parsed = supportPlanUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const existing = await prisma.supportPlan.findUnique({ where: { id: planId } })
    if (!existing || existing.guildId !== guildId) {
      return reply.code(404).send({ error: 'Support plan not found' })
    }

    try {
      const input = parsed.data
      if (input.name !== undefined) await assert_plan_name_available(guildId, input.name, planId)
      if (input.roleId !== undefined) await assert_role_manageable(guildId, input.roleId, request)

      const next_enabled = input.enabled ?? existing.enabled
      const archived_at = input.archived === true ? new Date() : existing.archivedAt
      if (next_enabled && archived_at === null && (!existing.enabled || input.enabled === true)) {
        await assert_active_plan_limit(guildId, planId)
      }

      const plan = await prisma.supportPlan.update({
        where: { id: planId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
          ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
          ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.archived === true ? { archivedAt: new Date(), enabled: false } : {}),
        },
      })

      return reply.send({ success: true, plan: serialize_plan(plan) })
    } catch (error) {
      request.log.warn({ err: safe_error_details(error), guildId, planId }, 'Failed to update support plan')
      return send_support_error(reply, error)
    }
  })

  fastify.post('/:guildId/support/plans/reorder', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const parsed = supportPlansReorderSchema.safeParse(request.body)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const ids = parsed.data.planIds
    const plans = await prisma.supportPlan.findMany({
      where: { guildId, id: { in: ids }, archivedAt: null },
      select: { id: true },
    })

    if (plans.length !== ids.length) {
      return reply.code(400).send({ error: 'Invalid plan ordering' })
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.supportPlan.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    return reply.send({ success: true })
  })

  fastify.get('/:guildId/support/payments', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const parsed = supportPaymentListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid query', details } : { error: 'Invalid query' })
    }

    const limit = parsed.data.limit ?? 50
    const payments = await prisma.supportPayment.findMany({
      where: {
        guildId,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        publicId: true,
        userId: true,
        planId: true,
        providerAccountId: true,
        livePixPaymentId: true,
        planNameSnapshot: true,
        amountCentsSnapshot: true,
        durationDaysSnapshot: true,
        roleIdSnapshot: true,
        currency: true,
        status: true,
        roleSyncStatus: true,
        confirmedAt: true,
        fulfilledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const page = payments.slice(0, limit)
    const nextCursor = payments.length > limit ? payments[limit]?.id ?? null : null
    return reply.send({ success: true, payments: page.map(serialize_payment), nextCursor })
  })

  fastify.get('/:guildId/support/entitlements', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const parsed = supportEntitlementListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid query', details } : { error: 'Invalid query' })
    }

    const limit = parsed.data.limit ?? 50
    const entitlements = await prisma.supportEntitlement.findMany({
      where: {
        guildId,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
      },
      orderBy: [{ expiresAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    })

    const page = entitlements.slice(0, limit)
    const nextCursor = entitlements.length > limit ? entitlements[limit]?.id ?? null : null
    return reply.send({ success: true, entitlements: page.map(serialize_entitlement), nextCursor })
  })

  fastify.post('/:guildId/support/entitlements/:entitlementId/revoke', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, entitlementId } = request.params as { guildId: string; entitlementId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const parsed = supportEntitlementRevokeSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      const details = validation_error_details(fastify, parsed.error)
      return reply.code(400).send(details ? { error: 'Invalid body', details } : { error: 'Invalid body' })
    }

    const entitlement = await prisma.supportEntitlement.findUnique({ where: { id: entitlementId } })
    if (!entitlement || entitlement.guildId !== guildId) {
      return reply.code(404).send({ error: 'Entitlement not found' })
    }

    const updated = await prisma.supportEntitlement.update({
      where: { id: entitlementId },
      data: {
        status: SupportEntitlementStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: parsed.data.reason ?? 'Revoked from dashboard',
        roleSyncStatus: SupportRoleSyncStatus.PENDING,
      },
    })

    try {
      await remove_support_entitlement_role({ guildId, entitlementId }, request.log)
    } catch (error) {
      request.log.warn({ err: safe_error_details(error), guildId, entitlementId }, 'Failed to remove revoked support role')
      await prisma.supportEntitlement.update({
        where: { id: entitlementId },
        data: { roleSyncStatus: SupportRoleSyncStatus.FAILED },
      })
    }

    return reply.send({ success: true, entitlement: serialize_entitlement(updated) })
  })

  fastify.post('/:guildId/support/entitlements/:entitlementId/retry-role-sync', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, entitlementId } = request.params as { guildId: string; entitlementId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const entitlement = await prisma.supportEntitlement.findUnique({
      where: { id: entitlementId },
      select: { guildId: true },
    })
    if (!entitlement || entitlement.guildId !== guildId) {
      return reply.code(404).send({ error: 'Entitlement not found' })
    }

    const result = await sync_support_entitlement_role({ guildId, entitlementId }, request.log)
    return reply.send({ success: true, result })
  })

  fastify.post('/:guildId/support/payments/:paymentPublicId/retry-role-sync', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId, paymentPublicId } = request.params as { guildId: string; paymentPublicId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const payment = await prisma.supportPayment.findUnique({
      where: { publicId: paymentPublicId },
      select: { id: true, guildId: true },
    })
    if (!payment || payment.guildId !== guildId) {
      return reply.code(404).send({ error: 'Payment not found' })
    }

    const result = await verify_and_fulfill_support_payment({ guildId, paymentId: payment.id }, request.log)
    return reply.send({ success: true, result })
  })

  fastify.post('/:guildId/support/maintenance/mark-expired-oauth', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const authz = await require_guild_admin(request, reply, guildId)
    if (!authz.ok) return

    const connection = await prisma.livePixConnection.findUnique({ where: { guildId } })
    if (!connection || connection.status !== LivePixConnectionStatus.CONNECTED || !connection.tokenExpiresAt) {
      return reply.send({ success: true, connection: serialize_livepix_connection(connection) })
    }

    if (connection.tokenExpiresAt.getTime() > Date.now()) {
      return reply.send({ success: true, connection: serialize_livepix_connection(connection) })
    }

    const updated = await prisma.livePixConnection.update({
      where: { id: connection.id },
      data: { status: LivePixConnectionStatus.REAUTH_REQUIRED, lastErrorCode: 'token_expired' },
    })

    return reply.send({ success: true, connection: serialize_livepix_connection(updated) })
  })
}
