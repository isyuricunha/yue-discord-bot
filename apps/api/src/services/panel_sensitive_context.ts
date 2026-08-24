import { randomUUID } from 'node:crypto'
import { prisma } from '@yuebot/database'
import type {
  panel_ai_page_context,
  panel_ai_sensitive_request,
  panel_ai_sensitive_scope,
} from '@yuebot/shared'

const DEFAULT_TTL_MS = 5 * 60 * 1000
const DEFAULT_MAX_ENTRIES = 1_000
const MAX_RECORDS = 10

export type panel_sensitive_context_db = Pick<
  typeof prisma,
  'guildMember' | 'modLog' | 'ticket' | 'giveaway'
>

export type loaded_sensitive_context = {
  scope: panel_ai_sensitive_scope
  title: string
  description: string
  providerContext: string
}

type pending_sensitive_context = loaded_sensitive_context & {
  id: string
  guildId: string
  userId: string
  conversationVersion: number
  expiresAt: number
}

function safe_string(value: unknown, max = 300): string {
  if (value === null || value === undefined) return 'not provided'
  const text = String(value).trim()
  if (!text) return 'not provided'
  const clipped = text.length > max ? `${text.slice(0, max)}…` : text
  return JSON.stringify(clipped)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

function safe_date(value: Date | string | null | undefined): string {
  if (!value) return 'not provided'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 'not provided' : date.toISOString()
}

function wrap_sensitive_context(scope: panel_ai_sensitive_scope, lines: string[]): string {
  return [
    '<SENSITIVE_PANEL_CONTEXT>',
    '- This data was shown to the administrator and explicitly approved for this turn only.',
    `- scope: ${safe_string(scope)}`,
    ...lines,
    '- Do not retain or claim access to this data after this turn.',
    '</SENSITIVE_PANEL_CONTEXT>',
  ].join('\n')
}

export function available_sensitive_scopes(
  pageContext: panel_ai_page_context | null | undefined,
): panel_ai_sensitive_scope[] {
  if (!pageContext) return []
  if (pageContext.pageKey === 'member-details' && pageContext.routeParams?.userId) {
    return ['member_moderation']
  }
  if (pageContext.pageKey === 'modlogs') return ['recent_modlogs']
  if (pageContext.pageKey === 'tickets') return ['recent_tickets']
  if (pageContext.pageKey === 'giveaway-details' && pageContext.routeParams?.giveawayId) {
    return ['giveaway_participants']
  }
  return []
}

function scope_is_available(
  pageContext: panel_ai_page_context | null | undefined,
  scope: panel_ai_sensitive_scope,
) {
  return available_sensitive_scopes(pageContext).includes(scope)
}

async function load_member_moderation(
  db: panel_sensitive_context_db,
  guildId: string,
  userId: string,
): Promise<loaded_sensitive_context | null> {
  const member = await db.guildMember.findUnique({
    where: { userId_guildId: { userId, guildId } },
    select: {
      userId: true,
      username: true,
      joinedAt: true,
      warnings: true,
      notes: true,
      modLogs: {
        orderBy: { createdAt: 'desc' },
        take: MAX_RECORDS,
        select: {
          action: true,
          reason: true,
          duration: true,
          moderatorId: true,
          createdAt: true,
        },
      },
    },
  })
  if (!member) return null

  const lines = [
    'Member moderation details:',
    `- user_id: ${safe_string(member.userId)}`,
    `- username: ${safe_string(member.username)}`,
    `- joined_at: ${safe_date(member.joinedAt)}`,
    `- warning_count: ${member.warnings}`,
    `- moderator_notes: ${safe_string(member.notes, 500)}`,
    `- recent_moderation_records: ${member.modLogs.length}`,
    ...member.modLogs.flatMap((log, index) => [
      `  - record_${index + 1}.action: ${safe_string(log.action)}`,
      `  - record_${index + 1}.reason: ${safe_string(log.reason)}`,
      `  - record_${index + 1}.duration: ${safe_string(log.duration)}`,
      `  - record_${index + 1}.moderator_id: ${safe_string(log.moderatorId)}`,
      `  - record_${index + 1}.created_at: ${safe_date(log.createdAt)}`,
    ]),
  ]

  return {
    scope: 'member_moderation',
    title: 'Histórico de moderação do membro',
    description: 'Inclui identificação do membro, notas administrativas, quantidade de avisos e até 10 registros recentes de moderação.',
    providerContext: wrap_sensitive_context('member_moderation', lines),
  }
}

async function load_recent_modlogs(
  db: panel_sensitive_context_db,
  guildId: string,
): Promise<loaded_sensitive_context> {
  const logs = await db.modLog.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    take: MAX_RECORDS,
    select: {
      userId: true,
      moderatorId: true,
      action: true,
      reason: true,
      duration: true,
      createdAt: true,
    },
  })

  const lines = [
    `Recent moderation records: ${logs.length}`,
    ...logs.flatMap((log, index) => [
      `- record_${index + 1}.user_id: ${safe_string(log.userId)}`,
      `- record_${index + 1}.moderator_id: ${safe_string(log.moderatorId)}`,
      `- record_${index + 1}.action: ${safe_string(log.action)}`,
      `- record_${index + 1}.reason: ${safe_string(log.reason)}`,
      `- record_${index + 1}.duration: ${safe_string(log.duration)}`,
      `- record_${index + 1}.created_at: ${safe_date(log.createdAt)}`,
    ]),
  ]

  return {
    scope: 'recent_modlogs',
    title: 'Registros recentes de moderação',
    description: 'Inclui até 10 ações recentes com usuário afetado, moderador, motivo, duração e horário.',
    providerContext: wrap_sensitive_context('recent_modlogs', lines),
  }
}

async function load_recent_tickets(
  db: panel_sensitive_context_db,
  guildId: string,
): Promise<loaded_sensitive_context> {
  const tickets = await db.ticket.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    take: MAX_RECORDS,
    select: {
      id: true,
      userId: true,
      status: true,
      createdAt: true,
      closedAt: true,
      closedByUserId: true,
      closeReason: true,
    },
  })

  const lines = [
    `Recent ticket metadata records: ${tickets.length}`,
    '- Ticket message contents are not stored here and are not included.',
    ...tickets.flatMap((ticket, index) => [
      `- ticket_${index + 1}.id: ${safe_string(ticket.id)}`,
      `- ticket_${index + 1}.user_id: ${safe_string(ticket.userId)}`,
      `- ticket_${index + 1}.status: ${safe_string(ticket.status)}`,
      `- ticket_${index + 1}.created_at: ${safe_date(ticket.createdAt)}`,
      `- ticket_${index + 1}.closed_at: ${safe_date(ticket.closedAt)}`,
      `- ticket_${index + 1}.closed_by_user_id: ${safe_string(ticket.closedByUserId)}`,
      `- ticket_${index + 1}.close_reason: ${safe_string(ticket.closeReason)}`,
    ]),
  ]

  return {
    scope: 'recent_tickets',
    title: 'Metadados recentes de tickets',
    description: 'Inclui até 10 tickets recentes, usuários, estado e motivo de encerramento. O conteúdo das mensagens não é armazenado nem enviado.',
    providerContext: wrap_sensitive_context('recent_tickets', lines),
  }
}

async function find_giveaway(
  db: panel_sensitive_context_db,
  guildId: string,
  identifier: string,
) {
  return db.giveaway.findFirst({
    where: {
      guildId,
      OR: [{ id: identifier }, { publicId: identifier }],
    },
    select: {
      id: true,
      publicId: true,
      title: true,
      ended: true,
      cancelled: true,
      entries: {
        where: { disqualified: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { userId: true, username: true, createdAt: true },
      },
      winners: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { userId: true, username: true, prize: true, createdAt: true },
      },
    },
  })
}

async function load_giveaway_participants(
  db: panel_sensitive_context_db,
  guildId: string,
  giveawayId: string,
): Promise<loaded_sensitive_context | null> {
  const giveaway = await find_giveaway(db, guildId, giveawayId)
  if (!giveaway) return null

  const lines = [
    `Giveaway title: ${safe_string(giveaway.title)}`,
    `- ended: ${giveaway.ended}`,
    `- cancelled: ${giveaway.cancelled}`,
    `- participant_records: ${giveaway.entries.length}`,
    ...giveaway.entries.flatMap((entry, index) => [
      `  - participant_${index + 1}.user_id: ${safe_string(entry.userId)}`,
      `  - participant_${index + 1}.username: ${safe_string(entry.username)}`,
      `  - participant_${index + 1}.entered_at: ${safe_date(entry.createdAt)}`,
    ]),
    `- winner_records: ${giveaway.winners.length}`,
    ...giveaway.winners.flatMap((winner, index) => [
      `  - winner_${index + 1}.user_id: ${safe_string(winner.userId)}`,
      `  - winner_${index + 1}.username: ${safe_string(winner.username)}`,
      `  - winner_${index + 1}.prize: ${safe_string(winner.prize)}`,
      `  - winner_${index + 1}.created_at: ${safe_date(winner.createdAt)}`,
    ]),
  ]

  return {
    scope: 'giveaway_participants',
    title: 'Participantes e vencedores do sorteio',
    description: 'Inclui até 20 participantes e 20 vencedores com IDs, nomes e horários, além do prêmio registrado para cada vencedor.',
    providerContext: wrap_sensitive_context('giveaway_participants', lines),
  }
}

export async function load_panel_sensitive_context(params: {
  db: panel_sensitive_context_db
  guildId: string
  pageContext: panel_ai_page_context | null | undefined
  scope: panel_ai_sensitive_scope
}): Promise<loaded_sensitive_context | null> {
  if (!scope_is_available(params.pageContext, params.scope)) return null

  if (params.scope === 'member_moderation') {
    const userId = params.pageContext?.routeParams?.userId
    return userId ? load_member_moderation(params.db, params.guildId, userId) : null
  }
  if (params.scope === 'recent_modlogs') {
    return load_recent_modlogs(params.db, params.guildId)
  }
  if (params.scope === 'recent_tickets') {
    return load_recent_tickets(params.db, params.guildId)
  }
  const giveawayId = params.pageContext?.routeParams?.giveawayId
  return giveawayId ? load_giveaway_participants(params.db, params.guildId, giveawayId) : null
}

export class PanelSensitiveContextStore {
  private readonly entries = new Map<string, pending_sensitive_context>()

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
    conversationVersion: number
    context: loaded_sensitive_context
  }): panel_ai_sensitive_request {
    this.prune()
    const id = randomUUID()
    const expiresAt = Date.now() + this.ttlMs
    this.entries.set(id, {
      id,
      guildId: input.guildId,
      userId: input.userId,
      conversationVersion: input.conversationVersion,
      expiresAt,
      ...input.context,
    })
    this.prune()
    return {
      id,
      scope: input.context.scope,
      title: input.context.title,
      description: input.context.description,
      preview: input.context.providerContext,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  consume(id: string, guildId: string, userId: string): pending_sensitive_context | null {
    this.prune()
    const entry = this.entries.get(id)
    if (!entry || entry.guildId !== guildId || entry.userId !== userId) return null
    this.entries.delete(id)
    return { ...entry }
  }

  delete_for_conversation(guildId: string, userId: string) {
    for (const [id, entry] of this.entries) {
      if (entry.guildId === guildId && entry.userId === userId) this.entries.delete(id)
    }
  }
}

export const panel_sensitive_context_store = new PanelSensitiveContextStore()
