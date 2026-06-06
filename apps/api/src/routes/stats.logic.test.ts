import test from 'node:test'
import assert from 'node:assert/strict'

import { summarize_giveaways, summarize_recent_activity } from './stats.logic'

test('summarize_giveaways derives active and total counts from grouped rows', () => {
  assert.deepEqual(summarize_giveaways([
    { ended: false, cancelled: false, _count: { id: 4 } },
    { ended: true, cancelled: false, _count: { id: 3 } },
    { ended: false, cancelled: true, _count: { id: 2 } },
  ]), {
    activeGiveaways: 4,
    totalGiveaways: 9,
  })
})

test('summarize_recent_activity builds seven ordered buckets and action totals', () => {
  const summary = summarize_recent_activity({
    now: new Date('2026-06-06T12:00:00.000Z'),
    moderationLogs: [
      { action: 'warn', createdAt: new Date('2026-06-01T08:00:00.000Z') },
      { action: 'warn', createdAt: new Date('2026-06-06T09:00:00.000Z') },
      { action: 'ban', createdAt: new Date('2026-06-06T10:00:00.000Z') },
    ],
    members: [
      { joinedAt: new Date('2026-06-03T12:00:00.000Z') },
      { joinedAt: null },
    ],
    economyTransactions: [
      { createdAt: new Date('2026-06-06T11:00:00.000Z') },
    ],
  })

  assert.equal(summary.moderationActions7d, 3)
  assert.deepEqual(summary.actionsByType, { warn: 2, ban: 1 })
  assert.deepEqual(summary.chartData, [
    { date: '31/05', newMembers: 0, moderationActions: 0, economy: 0 },
    { date: '01/06', newMembers: 0, moderationActions: 1, economy: 0 },
    { date: '02/06', newMembers: 0, moderationActions: 0, economy: 0 },
    { date: '03/06', newMembers: 1, moderationActions: 0, economy: 0 },
    { date: '04/06', newMembers: 0, moderationActions: 0, economy: 0 },
    { date: '05/06', newMembers: 0, moderationActions: 0, economy: 0 },
    { date: '06/06', newMembers: 0, moderationActions: 2, economy: 1 },
  ])
})
