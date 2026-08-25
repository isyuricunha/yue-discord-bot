import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { prisma } from '@yuebot/database'
import { create_support_plan_locked, SupportPlanWriteError } from './plan_writes'

const enabled = process.env.RUN_DATABASE_INTEGRATION === '1'

test('support plan writes preserve active-plan and name invariants under concurrency', { skip: !enabled }, async (t) => {
  const guildId = `support-plan-test-${randomUUID()}`
  await prisma.guild.create({ data: { id: guildId, name: 'Support Test', ownerId: 'owner' } })

  t.after(async () => {
    await prisma.guild.deleteMany({ where: { id: guildId } })
  })

  const results = await Promise.allSettled(
    Array.from({ length: 30 }, (_, index) => create_support_plan_locked({
      guildId,
      name: `Plan ${index}`,
      description: 'Test plan',
      amountCents: 100,
      durationDays: 30,
      roleId: `role-${index}`,
      enabled: true,
    }))
  )

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 25)
  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
  assert.equal(rejected.length, 5)
  assert.ok(rejected.every((result) => result.reason instanceof SupportPlanWriteError && result.reason.code === 'active_limit'))

  const duplicate = await Promise.allSettled([
    create_support_plan_locked({ guildId, name: 'Duplicate', description: 'x', amountCents: 100, durationDays: 30, roleId: 'role-a', enabled: false }),
    create_support_plan_locked({ guildId, name: ' duplicate ', description: 'x', amountCents: 100, durationDays: 30, roleId: 'role-b', enabled: false }),
  ])
  assert.equal(duplicate.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(duplicate.filter((result) => result.status === 'rejected').length, 1)
})
