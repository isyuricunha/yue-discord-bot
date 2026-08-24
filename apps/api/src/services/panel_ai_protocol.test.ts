import assert from 'node:assert/strict'
import test from 'node:test'

import { PanelAiProtocolStreamFilter, parse_panel_ai_output } from './panel_ai_protocol'

test('parses allowlisted actions and strips protocol blocks from visible text', () => {
  const output = parse_panel_ai_output([
    'Você pode revisar o AutoMod nesta página.',
    '<PANEL_ACTIONS>',
    JSON.stringify([
      { type: 'navigate', pageKey: 'automod' },
      { type: 'open_section', pageKey: 'automod', target: 'links' },
      { type: 'highlight_setting', pageKey: 'automod', target: 'capsThreshold' },
    ]),
    '</PANEL_ACTIONS>',
  ].join('\n'))

  assert.equal(output.response, 'Você pode revisar o AutoMod nesta página.')
  assert.equal(output.actions.length, 3)
  assert.equal(output.actions[0]?.type, 'navigate')
  assert.equal(output.actions[1]?.type, 'open_section')
  assert.equal(output.actions[2]?.type, 'highlight_setting')
})

test('drops invented pages, dynamic navigation targets, and unknown setting targets', () => {
  const output = parse_panel_ai_output([
    'Texto.',
    '<PANEL_ACTIONS>',
    JSON.stringify([
      { type: 'navigate', pageKey: 'not-real' },
      { type: 'navigate', pageKey: 'member-details' },
      { type: 'highlight_setting', pageKey: 'automod', target: 'inventedSetting' },
    ]),
    '</PANEL_ACTIONS>',
  ].join('\n'))

  assert.deepEqual(output.actions, [])
})

test('parses an allowlisted sensitive scope and ignores unknown scopes', () => {
  const accepted = parse_panel_ai_output(
    'Preciso da sua confirmação.\n<PANEL_SENSITIVE_REQUEST>{"scope":"member_moderation"}</PANEL_SENSITIVE_REQUEST>',
  )
  assert.equal(accepted.sensitiveScope, 'member_moderation')
  assert.equal(accepted.response, 'Preciso da sua confirmação.')

  const rejected = parse_panel_ai_output(
    'Texto.\n<PANEL_SENSITIVE_REQUEST>{"scope":"database_dump"}</PANEL_SENSITIVE_REQUEST>',
  )
  assert.equal(rejected.sensitiveScope, null)
})

test('stream filter emits ordinary text immediately and withholds split protocol markers', () => {
  const filter = new PanelAiProtocolStreamFilter()
  const chunks = [
    filter.push('Resposta longa '),
    filter.push('para o usuário.\n<PA'),
    filter.push('NEL_ACTIONS>[{"type":"navigate","pageKey":"xp"}]</PANEL_ACTIONS>'),
    filter.finish(),
  ]

  assert.equal(chunks.join(''), 'Resposta longa para o usuário.\n')
  assert.equal(chunks.join('').includes('PANEL_ACTIONS'), false)
})
