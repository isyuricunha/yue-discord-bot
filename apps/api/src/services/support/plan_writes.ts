import { Prisma, prisma } from '@yuebot/database'

const MAX_ACTIVE_SUPPORT_PLANS = 25

export class SupportPlanWriteError extends Error {
  constructor(
    public readonly code: 'duplicate_name' | 'active_limit',
    message: string,
  ) {
    super(message)
    this.name = 'SupportPlanWriteError'
  }
}

function normalized_plan_name(name: string) {
  return name.trim().toLocaleLowerCase('pt-BR')
}

// PostgreSQL advisory transaction locks serialize all support-plan writes per guild.
// Under READ COMMITTED, a waiter sees the state committed by the previous lock holder.
async function lock_support_plans(tx: Prisma.TransactionClient, guild_id: string) {
  const lock_key = `support-plans:${guild_id}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lock_key}))`
}

async function assert_name_available(
  tx: Prisma.TransactionClient,
  guild_id: string,
  name: string,
  excluding_plan_id?: string,
) {
  const plans = await tx.supportPlan.findMany({
    where: {
      guildId: guild_id,
      archivedAt: null,
      ...(excluding_plan_id ? { id: { not: excluding_plan_id } } : {}),
    },
    select: { name: true },
  })
  const normalized = normalized_plan_name(name)
  if (plans.some((plan) => normalized_plan_name(plan.name) === normalized)) {
    throw new SupportPlanWriteError('duplicate_name', 'A support plan with this name already exists')
  }
}

async function assert_active_limit(
  tx: Prisma.TransactionClient,
  guild_id: string,
  excluding_plan_id?: string,
) {
  const count = await tx.supportPlan.count({
    where: {
      guildId: guild_id,
      archivedAt: null,
      enabled: true,
      ...(excluding_plan_id ? { id: { not: excluding_plan_id } } : {}),
    },
  })
  if (count >= MAX_ACTIVE_SUPPORT_PLANS) {
    throw new SupportPlanWriteError('active_limit', 'A guild can have at most 25 active support plans')
  }
}

type create_support_plan_input = {
  guildId: string
  name: string
  description: string
  amountCents: number
  durationDays: number
  roleId: string
  enabled?: boolean
  sortOrder?: number
}

export async function create_support_plan_locked(input: create_support_plan_input) {
  return prisma.$transaction(async (tx) => {
    await lock_support_plans(tx, input.guildId)
    await assert_name_available(tx, input.guildId, input.name)
    if (input.enabled ?? true) await assert_active_limit(tx, input.guildId)

    return tx.supportPlan.create({
      data: {
        guildId: input.guildId,
        name: input.name,
        description: input.description,
        amountCents: input.amountCents,
        durationDays: input.durationDays,
        roleId: input.roleId,
        enabled: input.enabled ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    })
  })
}

type update_support_plan_input = {
  guildId: string
  planId: string
  name?: string
  description?: string
  amountCents?: number
  durationDays?: number
  roleId?: string
  enabled?: boolean
  sortOrder?: number
  archived?: boolean
}

export async function update_support_plan_locked(input: update_support_plan_input) {
  return prisma.$transaction(async (tx) => {
    await lock_support_plans(tx, input.guildId)
    const existing = await tx.supportPlan.findUnique({ where: { id: input.planId } })
    if (!existing || existing.guildId !== input.guildId) return null

    const next_name = input.name ?? existing.name
    const next_enabled = input.archived === true ? false : (input.enabled ?? existing.enabled)
    const next_archived_at = input.archived === true ? new Date() : existing.archivedAt

    await assert_name_available(tx, input.guildId, next_name, input.planId)
    if (next_enabled && next_archived_at === null) {
      await assert_active_limit(tx, input.guildId, input.planId)
    }

    return tx.supportPlan.update({
      where: { id: input.planId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
        ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.archived === true ? { archivedAt: next_archived_at, enabled: false } : {}),
      },
    })
  })
}
