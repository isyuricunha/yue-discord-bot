import assert from 'node:assert/strict'
import test from 'node:test'
import { MessageFlags } from 'discord.js'

import { safe_event, safe_interaction_event } from './safe_event_handler'

type repliable_interaction = {
  isRepliable: () => boolean
  replied: boolean
  deferred: boolean
  reply: (payload: unknown) => Promise<void>
}

function fake_interaction(overrides: Partial<repliable_interaction> = {}): repliable_interaction {
  return {
    isRepliable: () => true,
    replied: false,
    deferred: false,
    reply: async () => {},
    ...overrides,
  }
}

test('safe_event swallows handler rejections', async () => {
  await assert.doesNotReject(() =>
    safe_event('test', async () => {
      throw new Error('boom')
    })
  )
})

test('safe_event still runs successful handlers', async () => {
  let ran = false
  await safe_event('test', async () => {
    ran = true
  })
  assert.equal(ran, true)
})

test('safe_interaction_event replies ephemerally when the interaction is still unanswered', async () => {
  const payloads: unknown[] = []
  const interaction = fake_interaction({
    reply: async (payload) => {
      payloads.push(payload)
    },
  })

  await safe_interaction_event(
    'interactionCreate',
    interaction as never,
    async () => {
      throw new Error('db down')
    }
  )

  assert.equal(payloads.length, 1)
  assert.deepEqual((payloads[0] as { flags: number }).flags, MessageFlags.Ephemeral)
})

test('safe_interaction_event does not double-answer an already replied interaction', async () => {
  let replied = 0
  const interaction = fake_interaction({
    replied: true,
    reply: async () => {
      replied += 1
    },
  })

  await safe_interaction_event(
    'interactionCreate',
    interaction as never,
    async () => {
      throw new Error('boom')
    }
  )

  assert.equal(replied, 0)
})

test('safe_interaction_event swallows reply failures too', async () => {
  const interaction = fake_interaction({
    reply: async () => {
      throw new Error('discord unavailable')
    },
  })

  await assert.doesNotReject(() =>
    safe_interaction_event(
      'interactionCreate',
      interaction as never,
      async () => {
        throw new Error('boom')
      }
    )
  )
})

test('safe_interaction_event tolerates interaction objects without isRepliable', async () => {
  const interaction = { replied: false, deferred: false }

  await assert.doesNotReject(() =>
    safe_interaction_event(
      'interactionCreate',
      interaction as never,
      async () => {
        throw new Error('boom')
      }
    )
  )
})
