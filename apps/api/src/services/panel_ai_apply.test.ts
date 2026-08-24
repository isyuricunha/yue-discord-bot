import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PanelAiApplyProposalStore,
  confirm_panel_ai_apply,
  prepare_panel_ai_apply,
} from './panel_ai_apply'

type state = {
  guildConfig: Record<string, unknown> | null
  writes: number
  audits: Array<Record<string, unknown>>
}

function make_db(input: state) {
  const db: any = {
    guildConfig: {
      findUnique: async () => input.guildConfig,
      upsert: async (args: any) => {
        input.writes += 1
        input.guildConfig = {
          ...(input.guildConfig ?? {}),
          ...(args.update ?? args.create ?? {}),
        }
        return input.guildConfig
      },
    },
    guildAntiRaidConfig: {
      findUnique: async () => null,
      upsert: async () => assert.fail('anti-raid should not be written'),
    },
    guildXpConfig: {
      findUnique: async () => null,
      upsert: async () => assert.fail('xp should not be written'),
    },
    guildAutoroleConfig: {
      findUnique: async () => null,
      upsert: async () => assert.fail('autorole should not be written'),
    },
    auditLog: {
      create: async (args: any) => {
        input.audits.push(args.data)
        return args.data
      },
    },
  }
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback(db)
  return db
}

test('prepare validates the server-apply page allowlist and removes no-op changes', async () => {
  const state: state = {
    guildConfig: { guildId: 'guild-1', locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
    writes: 0,
    audits: [],
  }
  const db = make_db(state)
  const store = new PanelAiApplyProposalStore()

  const invalid = await prepare_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    pageKey: 'welcome',
    changes: [{ target: 'welcomeMessage', value: 'hello' }],
  })
  assert.deepEqual(invalid, { kind: 'invalid' })

  const noop = await prepare_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    pageKey: 'settings',
    changes: [{ target: 'locale', value: 'pt-BR' }],
  })
  assert.deepEqual(noop, { kind: 'noop' })
  assert.equal(state.writes, 0)
})

test('confirmed apply persists once, writes an audit event, and replays idempotently', async () => {
  const state: state = {
    guildConfig: { guildId: 'guild-1', locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
    writes: 0,
    audits: [],
  }
  const db = make_db(state)
  const store = new PanelAiApplyProposalStore()

  const prepared = await prepare_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    pageKey: 'settings',
    changes: [
      { target: 'locale', value: 'en-US' },
      { target: 'timezone', value: 'Asia/Tokyo' },
    ],
  })
  assert.equal(prepared.kind, 'proposal')
  if (prepared.kind !== 'proposal') assert.fail('Expected proposal')
  assert.deepEqual(
    prepared.proposal.changes.map(({ target, before, after }) => ({ target, before, after })),
    [
      { target: 'locale', before: 'pt-BR', after: 'en-US' },
      { target: 'timezone', before: 'America/Sao_Paulo', after: 'Asia/Tokyo' },
    ],
  )

  const first = await confirm_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    proposalId: prepared.proposal.id,
  })
  assert.equal(first.kind, 'applied')
  if (first.kind !== 'applied') assert.fail('Expected applied result')
  assert.equal(first.result.replayed, false)
  assert.equal(state.guildConfig?.locale, 'en-US')
  assert.equal(state.guildConfig?.timezone, 'Asia/Tokyo')
  assert.equal(state.writes, 1)
  assert.equal(state.audits.length, 1)
  assert.equal(state.audits[0]?.action, 'panel_ai_config_apply')
  assert.equal(state.audits[0]?.actorUserId, 'user-1')

  const replay = await confirm_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    proposalId: prepared.proposal.id,
  })
  assert.equal(replay.kind, 'applied')
  if (replay.kind !== 'applied') assert.fail('Expected replayed result')
  assert.equal(replay.result.replayed, true)
  assert.equal(state.writes, 1)
  assert.equal(state.audits.length, 1)
})

test('confirmation aborts when a targeted value changed after the proposal', async () => {
  const state: state = {
    guildConfig: { guildId: 'guild-1', locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
    writes: 0,
    audits: [],
  }
  const db = make_db(state)
  const store = new PanelAiApplyProposalStore()

  const prepared = await prepare_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    pageKey: 'settings',
    changes: [{ target: 'locale', value: 'en-US' }],
  })
  assert.equal(prepared.kind, 'proposal')
  if (prepared.kind !== 'proposal') assert.fail('Expected proposal')

  state.guildConfig = { ...state.guildConfig, locale: 'es-ES' }

  const result = await confirm_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    proposalId: prepared.proposal.id,
  })
  assert.deepEqual(result, { kind: 'conflict' })
  assert.equal(state.guildConfig.locale, 'es-ES')
  assert.equal(state.writes, 0)
  assert.equal(state.audits.length, 0)

  const retry = await confirm_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    proposalId: prepared.proposal.id,
  })
  assert.deepEqual(retry, { kind: 'missing' })
})

test('proposal token is identity-bound and expires', async () => {
  const state: state = {
    guildConfig: { guildId: 'guild-1', locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
    writes: 0,
    audits: [],
  }
  const db = make_db(state)
  const store = new PanelAiApplyProposalStore(1)

  const prepared = await prepare_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    pageKey: 'settings',
    changes: [{ target: 'locale', value: 'en-US' }],
  })
  assert.equal(prepared.kind, 'proposal')
  if (prepared.kind !== 'proposal') assert.fail('Expected proposal')

  const wrongUser = await confirm_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-2',
    proposalId: prepared.proposal.id,
  })
  assert.deepEqual(wrongUser, { kind: 'missing' })

  await new Promise((resolve) => setTimeout(resolve, 5))
  const expired = await confirm_panel_ai_apply({
    db,
    store,
    guildId: 'guild-1',
    userId: 'user-1',
    proposalId: prepared.proposal.id,
  })
  assert.deepEqual(expired, { kind: 'missing' })
})
