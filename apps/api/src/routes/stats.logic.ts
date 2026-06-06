export type ModerationActivityRow = {
  action: string
  createdAt: Date
}

export type MemberActivityRow = {
  joinedAt: Date | null
}

export type EconomyActivityRow = {
  createdAt: Date
}

export type GiveawayCountGroup = {
  ended: boolean
  cancelled: boolean
  _count: {
    id: number
  }
}

export function summarize_giveaways(groups: GiveawayCountGroup[]) {
  let activeGiveaways = 0
  let totalGiveaways = 0

  for (const group of groups) {
    totalGiveaways += group._count.id
    if (!group.ended && !group.cancelled) {
      activeGiveaways += group._count.id
    }
  }

  return {
    activeGiveaways,
    totalGiveaways,
  }
}

export function summarize_recent_activity(input: {
  now: Date
  moderationLogs: ModerationActivityRow[]
  members: MemberActivityRow[]
  economyTransactions: EconomyActivityRow[]
}) {
  const date_labels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(input.now)
    date.setDate(date.getDate() - (6 - index))
    return date.toISOString().split('T')[0]
  })

  const chart_data_map = new Map<string, {
    date: string
    newMembers: number
    moderationActions: number
    economy: number
  }>()

  for (const date of date_labels) {
    const [, month, day] = date.split('-')
    chart_data_map.set(date, {
      date: `${day}/${month}`,
      newMembers: 0,
      moderationActions: 0,
      economy: 0,
    })
  }

  const actionsByType: Record<string, number> = {}

  for (const log of input.moderationLogs) {
    actionsByType[log.action] = (actionsByType[log.action] ?? 0) + 1

    const date = log.createdAt.toISOString().split('T')[0]
    const bucket = chart_data_map.get(date)
    if (bucket) bucket.moderationActions += 1
  }

  for (const member of input.members) {
    if (!member.joinedAt) continue
    const date = member.joinedAt.toISOString().split('T')[0]
    const bucket = chart_data_map.get(date)
    if (bucket) bucket.newMembers += 1
  }

  for (const transaction of input.economyTransactions) {
    const date = transaction.createdAt.toISOString().split('T')[0]
    const bucket = chart_data_map.get(date)
    if (bucket) bucket.economy += 1
  }

  return {
    moderationActions7d: input.moderationLogs.length,
    actionsByType,
    chartData: Array.from(chart_data_map.values()),
  }
}
