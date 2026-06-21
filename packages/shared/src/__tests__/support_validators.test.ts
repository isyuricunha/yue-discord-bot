import assert from 'node:assert/strict'
import test from 'node:test'

import {
  supportEntitlementListQuerySchema,
  supportEntitlementRevokeSchema,
  supportPaymentListQuerySchema,
  supportPlanCreateSchema,
  supportPlansReorderSchema,
} from '../validators'

test('support plan validator normalizes safe plan input', () => {
  const parsed = supportPlanCreateSchema.parse({
    name: '  Bronze  ',
    description: '  Monthly support  ',
    amountCents: '1500',
    durationDays: '30',
    roleId: '1234567890',
  })

  assert.deepEqual(parsed, {
    name: 'Bronze',
    description: 'Monthly support',
    amountCents: 1500,
    durationDays: 30,
    roleId: '1234567890',
  })
})

test('support plan validator rejects unsafe prices and durations', () => {
  assert.equal(
    supportPlanCreateSchema.safeParse({
      name: 'Bronze',
      description: 'Monthly support',
      amountCents: 99,
      durationDays: 30,
      roleId: '1234567890',
    }).success,
    false
  )

  assert.equal(
    supportPlanCreateSchema.safeParse({
      name: 'Bronze',
      description: 'Monthly support',
      amountCents: 1500,
      durationDays: 0,
      roleId: '1234567890',
    }).success,
    false
  )
})

test('support plan reorder validator caps one request to the active plan limit', () => {
  assert.equal(supportPlansReorderSchema.safeParse({ planIds: Array.from({ length: 25 }, (_, index) => `plan-${index}`) }).success, true)
  assert.equal(supportPlansReorderSchema.safeParse({ planIds: Array.from({ length: 26 }, (_, index) => `plan-${index}`) }).success, false)
})

test('support list validators accept only known statuses and bounded limits', () => {
  assert.deepEqual(supportPaymentListQuerySchema.parse({ status: 'FULFILLED', limit: '50' }), {
    status: 'FULFILLED',
    limit: 50,
  })
  assert.deepEqual(supportEntitlementListQuerySchema.parse({ status: 'ACTIVE', limit: '25' }), {
    status: 'ACTIVE',
    limit: 25,
  })

  assert.equal(supportPaymentListQuerySchema.safeParse({ status: 'PAID' }).success, false)
  assert.equal(supportEntitlementListQuerySchema.safeParse({ status: 'PENDING' }).success, false)
  assert.equal(supportPaymentListQuerySchema.safeParse({ limit: '101' }).success, false)
})

test('support entitlement revoke validator trims and bounds optional reasons', () => {
  assert.deepEqual(supportEntitlementRevokeSchema.parse({ reason: '  Manual refund  ' }), {
    reason: 'Manual refund',
  })
  assert.equal(supportEntitlementRevokeSchema.safeParse({ reason: 'a'.repeat(501) }).success, false)
})
