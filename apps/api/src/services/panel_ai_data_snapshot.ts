export type panel_ai_data_snapshot_db = {
  guildMember: { count: (args: any) => Promise<number> }
  ticket: { count: (args: any) => Promise<number> }
  fanArt: { count: (args: any) => Promise<number> }
  modLog: { count: (args: any) => Promise<number> }
  discordDelivery: { count: (args: any) => Promise<number> }
}

type count_delegate = { count: (args: any) => Promise<number> }

async function safe_count(delegate: count_delegate | undefined, where: Record<string, unknown>): Promise<number | null> {
  if (!delegate) return null
  try {
    return await delegate.count({ where })
  } catch {
    return null
  }
}

/**
 * Builds a compact live-data snapshot for the panel assistant context
 * (improvement #1, v1). Every count degrades independently: a failed read is
 * reported as unavailable instead of breaking the turn.
 */
export async function load_panel_ai_data_snapshot(
  db: panel_ai_data_snapshot_db,
  guildId: string,
): Promise<string | null> {
  const week_ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [members, open_tickets, pending_fanarts, modlogs_week, failed_deliveries] = await Promise.all([
    safe_count(db.guildMember as unknown as count_delegate, { guildId }),
    safe_count(db.ticket as unknown as count_delegate, { guildId, status: 'open' }),
    safe_count(db.fanArt as unknown as count_delegate, { status: 'pending' }),
    safe_count(db.modLog as unknown as count_delegate, { guildId, createdAt: { gte: week_ago } }),
    safe_count(db.discordDelivery as unknown as count_delegate, { guildId, failedAt: { not: null } }),
  ])

  const parts: Array<string> = []
  if (members !== null) parts.push(`Membros no servidor: ${members}`)
  if (open_tickets !== null) parts.push(`Tickets abertos: ${open_tickets}`)
  if (pending_fanarts !== null) parts.push(`Fan arts pendentes de revisão (global): ${pending_fanarts}`)
  if (modlogs_week !== null) parts.push(`Ações de moderação nos últimos 7 dias: ${modlogs_week}`)
  if (failed_deliveries !== null) parts.push(`Entregas do Discord falhadas (acumulado): ${failed_deliveries}`)

  if (parts.length === 0) return null

  return [
    '## Dados atuais do servidor (snapshot ao vivo)',
    ...parts.map((part) => `- ${part}`),
    'Use estes números quando o usuário perguntar sobre quantidades atuais. Não invente outros valores.',
  ].join('\n')
}
