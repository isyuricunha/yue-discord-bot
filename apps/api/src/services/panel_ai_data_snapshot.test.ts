import assert from 'node:assert/strict'
import test from 'node:test'

import { load_panel_ai_data_snapshot } from './panel_ai_data_snapshot'

function make_db(overrides: Record<string, number | undefined> = {}) {
  const count = (key: string) => async () => {
    const value = overrides[key]
    if (value === undefined) throw new Error('unavailable')
    return value
  }
  return {
    guildMember: { count: count('members') },
    ticket: { count: count('tickets') },
    fanArt: { count: count('fanarts') },
    modLog: { count: count('modlogs') },
    discordDelivery: { count: count('deliveries') },
  }
}

test('snapshot composes the live aggregates as a readable block', async () => {
  const text = await load_panel_ai_data_snapshot(make_db({ members: 120, tickets: 2, fanarts: 1, modlogs: 5, deliveries: 3 }), 'guild-1')

  assert.ok(text)
  assert.match(text, /Membros no servidor: 120/)
  assert.match(text, /Tickets abertos: 2/)
  assert.match(text, /Fan arts pendentes de revisão \(global\): 1/)
  assert.match(text, /Ações de moderação nos últimos 7 dias: 5/)
  assert.match(text, /Entregas do Discord falhadas \(acumulado\): 3/)
  assert.match(text, /Não invente outros valores/)
})

test('snapshot omits unavailable reads instead of failing the turn', async () => {
  const text = await load_panel_ai_data_snapshot(
    make_db({ members: 120, tickets: 2, fanarts: 0, modlogs: 0, deliveries: 0 }) as never,
    'guild-1',
  )
  assert.ok(text)
  void text
})

test('snapshot returns null when every read fails', async () => {
  const text = await load_panel_ai_data_snapshot(make_db({}), 'guild-1')
  assert.equal(text, null)
})
