import { randomUUID } from 'node:crypto'
import { prisma, type Prisma } from '@yuebot/database'
import {
  is_panel_ai_apply_page_key,
  validate_panel_ai_apply_changes,
  type panel_ai_apply_diff_change,
  type panel_ai_apply_page_key,
  type panel_ai_apply_proposal,
  type panel_ai_apply_result,
  type panel_ai_prefill_change,
  type panel_ai_prefill_value,
} from '@yuebot/shared'

const DEFAULT_TTL_MS = 5 * 60 * 1000
const DEFAULT_MAX_ENTRIES = 1_000
const SERIALIZABLE_MAX_ATTEMPTS = 3

export type panel_ai_apply_db = Pick<
  typeof prisma,
  'guildConfig' | 'guildAntiRaidConfig' | 'guildXpConfig' | 'guildAutoroleConfig' | 'auditLog' | '$transaction'
>

type pending_proposal = {
  id: string
  guildId: string
  userId: string
  pageKey: panel_ai_apply_page_key
  changes: panel_ai_apply_diff_change[]
  expiresAt: number
  state: 'pending' | 'applying' | 'applied'
  result?: panel_ai_apply_result
}

type acquired_proposal =
  | { kind: 'pending'; proposal: pending_proposal }
  | { kind: 'applied'; result: panel_ai_apply_result }
  | { kind: 'busy' }
  | { kind: 'missing' }

export type prepare_panel_ai_apply_result =
  | { kind: 'proposal'; proposal: panel_ai_apply_proposal }
  | { kind: 'noop' }
  | { kind: 'invalid' }

export type confirm_panel_ai_apply_result =
  | { kind: 'applied'; result: panel_ai_apply_result }
  | { kind: 'conflict' }
  | { kind: 'busy' }
  | { kind: 'missing' }

const DEFAULTS: Record<panel_ai_apply_page_key, Record<string, panel_ai_prefill_value>> = {
  settings: {
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
  },
  automod: {
    capsEnabled: false,
    capsThreshold: 70,
    capsMinLength: 10,
    aiModerationEnabled: false,
    aiModerationLevel: 'medio',
  },
  antiraid: {
    enabled: false,
    joinThreshold: 10,
    joinTimeWindow: 60,
    cooldown: 300,
  },
  xp: {
    enabled: true,
    voiceXpEnabled: false,
    voiceXpNotificationsEnabled: true,
    voiceXpRate: 10,
    rewardMode: 'stack',
  },
  autorole: {
    enabled: false,
    delaySeconds: 0,
    onlyAfterFirstMessage: false,
  },
}

function same_value(left: panel_ai_prefill_value, right: panel_ai_prefill_value) {
  return left === right
}

function is_serializable_conflict(error: unknown) {
  const code = typeof (error as { code?: unknown })?.code === 'string'
    ? (error as { code: string }).code
    : ''
  return code === 'P2034' || code === '40001'
}

async function with_serializable_retry<T>(
  db: panel_ai_apply_db,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 1; attempt <= SERIALIZABLE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable' })
    } catch (error: unknown) {
      if (!is_serializable_conflict(error) || attempt === SERIALIZABLE_MAX_ATTEMPTS) {
        throw error
      }
    }
  }

  throw new Error('Serializable transaction retry loop exhausted')
}

async function load_current_values(
  db: panel_ai_apply_db,
  guildId: string,
  pageKey: panel_ai_apply_page_key,
): Promise<Record<string, panel_ai_prefill_value>> {
  if (pageKey === 'settings' || pageKey === 'automod') {
    const row = await db.guildConfig.findUnique({ where: { guildId } })
    if (pageKey === 'settings') {
      return {
        locale: row?.locale ?? DEFAULTS.settings.locale,
        timezone: row?.timezone ?? DEFAULTS.settings.timezone,
      }
    }
    return {
      capsEnabled: row?.capsEnabled ?? DEFAULTS.automod.capsEnabled,
      capsThreshold: row?.capsThreshold ?? DEFAULTS.automod.capsThreshold,
      capsMinLength: row?.capsMinLength ?? DEFAULTS.automod.capsMinLength,
      aiModerationEnabled: row?.aiModerationEnabled ?? DEFAULTS.automod.aiModerationEnabled,
      aiModerationLevel: row?.aiModerationLevel ?? DEFAULTS.automod.aiModerationLevel,
    }
  }

  if (pageKey === 'antiraid') {
    const row = await db.guildAntiRaidConfig.findUnique({ where: { guildId } })
    return {
      enabled: row?.enabled ?? DEFAULTS.antiraid.enabled,
      joinThreshold: row?.joinThreshold ?? DEFAULTS.antiraid.joinThreshold,
      joinTimeWindow: row?.joinTimeWindow ?? DEFAULTS.antiraid.joinTimeWindow,
      cooldown: row?.cooldown ?? DEFAULTS.antiraid.cooldown,
    }
  }

  if (pageKey === 'xp') {
    const row = await db.guildXpConfig.findUnique({ where: { guildId } })
    return {
      enabled: row?.enabled ?? DEFAULTS.xp.enabled,
      voiceXpEnabled: row?.voiceXpEnabled ?? DEFAULTS.xp.voiceXpEnabled,
      voiceXpNotificationsEnabled:
        row?.voiceXpNotificationsEnabled ?? DEFAULTS.xp.voiceXpNotificationsEnabled,
      voiceXpRate: row?.voiceXpRate ?? DEFAULTS.xp.voiceXpRate,
      rewardMode: row?.rewardMode ?? DEFAULTS.xp.rewardMode,
    }
  }

  const row = await db.guildAutoroleConfig.findUnique({ where: { guildId } })
  return {
    enabled: row?.enabled ?? DEFAULTS.autorole.enabled,
    delaySeconds: row?.delaySeconds ?? DEFAULTS.autorole.delaySeconds,
    onlyAfterFirstMessage: row?.onlyAfterFirstMessage ?? DEFAULTS.autorole.onlyAfterFirstMessage,
  }
}

function values_for_changes(
  current: Record<string, panel_ai_prefill_value>,
  changes: panel_ai_prefill_change[],
): panel_ai_apply_diff_change[] | null {
  const diff: panel_ai_apply_diff_change[] = []
  for (const change of changes) {
    const before = current[change.target]
    if (before === undefined) return null
    if (same_value(before, change.value)) continue
    diff.push({
      target: change.target,
      targetLabel: change.targetLabel,
      before,
      after: change.value,
    })
  }
  return diff
}

function update_object(changes: panel_ai_apply_diff_change[]) {
  return Object.fromEntries(changes.map((change) => [change.target, change.after]))
}

async function persist_changes(
  tx: panel_ai_apply_db,
  guildId: string,
  pageKey: panel_ai_apply_page_key,
  changes: panel_ai_apply_diff_change[],
) {
  const update = update_object(changes)

  if (pageKey === 'settings' || pageKey === 'automod') {
    await tx.guildConfig.upsert({
      where: { guildId },
      update: update as Prisma.GuildConfigUncheckedUpdateInput,
      create: { guildId, ...update } as Prisma.GuildConfigUncheckedCreateInput,
    })
    return
  }

  if (pageKey === 'antiraid') {
    await tx.guildAntiRaidConfig.upsert({
      where: { guildId },
      update: update as Prisma.GuildAntiRaidConfigUncheckedUpdateInput,
      create: { guildId, ...update } as Prisma.GuildAntiRaidConfigUncheckedCreateInput,
    })
    return
  }

  if (pageKey === 'xp') {
    await tx.guildXpConfig.upsert({
      where: { guildId },
      update: update as Prisma.GuildXpConfigUncheckedUpdateInput,
      create: { guildId, ...update } as Prisma.GuildXpConfigUncheckedCreateInput,
    })
    return
  }

  await tx.guildAutoroleConfig.upsert({
    where: { guildId },
    update: update as Prisma.GuildAutoroleConfigUncheckedUpdateInput,
    create: { guildId, ...update } as Prisma.GuildAutoroleConfigUncheckedCreateInput,
  })
}

export class PanelAiApplyProposalStore {
  private readonly entries = new Map<string, pending_proposal>()

  constructor(
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
  ) {}

  private prune() {
    const now = Date.now()
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(id)
    }
    while (this.entries.size > this.maxEntries) {
      const first = this.entries.keys().next()
      if (first.done) break
      this.entries.delete(first.value)
    }
  }

  create(input: {
    guildId: string
    userId: string
    pageKey: panel_ai_apply_page_key
    changes: panel_ai_apply_diff_change[]
  }): panel_ai_apply_proposal {
    this.prune()
    const id = randomUUID()
    const expiresAt = Date.now() + this.ttlMs
    this.entries.set(id, {
      id,
      guildId: input.guildId,
      userId: input.userId,
      pageKey: input.pageKey,
      changes: input.changes.map((change) => ({ ...change })),
      expiresAt,
      state: 'pending',
    })
    this.prune()
    return {
      id,
      pageKey: input.pageKey,
      changes: input.changes.map((change) => ({ ...change })),
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  acquire(id: string, guildId: string, userId: string): acquired_proposal {
    this.prune()
    const entry = this.entries.get(id)
    if (!entry || entry.guildId !== guildId || entry.userId !== userId) return { kind: 'missing' }
    if (entry.state === 'applied' && entry.result) return { kind: 'applied', result: { ...entry.result } }
    if (entry.state === 'applying') return { kind: 'busy' }
    entry.state = 'applying'
    return {
      kind: 'pending',
      proposal: {
        ...entry,
        changes: entry.changes.map((change) => ({ ...change })),
      },
    }
  }

  complete(id: string, result: panel_ai_apply_result) {
    const entry = this.entries.get(id)
    if (!entry) return
    entry.state = 'applied'
    entry.result = { ...result }
  }

  release(id: string) {
    const entry = this.entries.get(id)
    if (entry?.state === 'applying') entry.state = 'pending'
  }

  invalidate(id: string) {
    this.entries.delete(id)
  }
}

export const panel_ai_apply_proposal_store = new PanelAiApplyProposalStore()

export async function prepare_panel_ai_apply(params: {
  db: panel_ai_apply_db
  store: PanelAiApplyProposalStore
  guildId: string
  userId: string
  pageKey: unknown
  changes: unknown
}): Promise<prepare_panel_ai_apply_result> {
  if (!is_panel_ai_apply_page_key(params.pageKey)) return { kind: 'invalid' }
  const normalized = validate_panel_ai_apply_changes(params.pageKey, params.changes)
  if (!normalized) return { kind: 'invalid' }

  const current = await load_current_values(params.db, params.guildId, params.pageKey)
  const diff = values_for_changes(current, normalized)
  if (!diff) return { kind: 'invalid' }
  if (diff.length === 0) return { kind: 'noop' }

  return {
    kind: 'proposal',
    proposal: params.store.create({
      guildId: params.guildId,
      userId: params.userId,
      pageKey: params.pageKey,
      changes: diff,
    }),
  }
}

export async function confirm_panel_ai_apply(params: {
  db: panel_ai_apply_db
  store: PanelAiApplyProposalStore
  guildId: string
  userId: string
  proposalId: string
}): Promise<confirm_panel_ai_apply_result> {
  const acquired = params.store.acquire(params.proposalId, params.guildId, params.userId)
  if (acquired.kind === 'missing') return { kind: 'missing' }
  if (acquired.kind === 'busy') return { kind: 'busy' }
  if (acquired.kind === 'applied') {
    return { kind: 'applied', result: { ...acquired.result, replayed: true } }
  }

  const proposal = acquired.proposal
  try {
    const result = await with_serializable_retry(params.db, async (tx) => {
      const current = await load_current_values(tx as panel_ai_apply_db, params.guildId, proposal.pageKey)
      const conflict = proposal.changes.some((change) => {
        const value = current[change.target]
        return value === undefined || !same_value(value, change.before)
      })
      if (conflict) return null

      await persist_changes(tx as panel_ai_apply_db, params.guildId, proposal.pageKey, proposal.changes)
      const appliedAt = new Date().toISOString()
      const response: panel_ai_apply_result = {
        proposalId: proposal.id,
        pageKey: proposal.pageKey,
        changes: proposal.changes.map((change) => ({ ...change })),
        appliedAt,
        replayed: false,
      }

      await tx.auditLog.create({
        data: {
          guildId: params.guildId,
          action: 'panel_ai_config_apply',
          actorUserId: params.userId,
          data: {
            source: 'panel-ai',
            proposalId: proposal.id,
            pageKey: proposal.pageKey,
            changes: proposal.changes,
          },
        },
      })

      return response
    })

    if (!result) {
      params.store.invalidate(proposal.id)
      return { kind: 'conflict' }
    }

    params.store.complete(proposal.id, result)
    return { kind: 'applied', result }
  } catch (error: unknown) {
    if (is_serializable_conflict(error)) {
      params.store.invalidate(proposal.id)
      return { kind: 'conflict' }
    }
    params.store.release(proposal.id)
    throw error
  }
}
