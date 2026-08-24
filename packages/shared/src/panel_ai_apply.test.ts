import test from 'node:test'
import assert from 'node:assert/strict'

import {
  is_panel_ai_apply_page_key,
  validate_panel_ai_apply_changes,
} from './panel_ai_apply'

test('server apply is limited to the five explicitly supported configuration pages', () => {
  for (const pageKey of ['settings', 'automod', 'antiraid', 'xp', 'autorole']) {
    assert.equal(is_panel_ai_apply_page_key(pageKey), true)
  }
  for (const pageKey of ['welcome', 'tickets', 'members', 'giveaways', 'assistant']) {
    assert.equal(is_panel_ai_apply_page_key(pageKey), false)
  }
})

test('server apply reuses the prefill value allowlist and rejects duplicates or invalid values', () => {
  assert.deepEqual(
    validate_panel_ai_apply_changes('automod', [
      { target: 'capsEnabled', value: true },
      { target: 'capsThreshold', value: 80 },
    ])?.map(({ target, targetLabel, value }) => ({ target, targetLabel, value })),
    [
      { target: 'capsEnabled', targetLabel: 'Anti-CAPS', value: true },
      { target: 'capsThreshold', targetLabel: 'Limite de CAPS (%)', value: 80 },
    ],
  )

  assert.equal(validate_panel_ai_apply_changes('automod', [{ target: 'capsThreshold', value: 101 }]), null)
  assert.equal(validate_panel_ai_apply_changes('settings', [{ target: 'locale', value: 'xx-YY' }]), null)
  assert.equal(validate_panel_ai_apply_changes('xp', [{ target: 'voiceXpRate', value: '25' }]), null)
  assert.equal(
    validate_panel_ai_apply_changes('autorole', [
      { target: 'enabled', value: true },
      { target: 'enabled', value: false },
    ]),
    null,
  )
})
