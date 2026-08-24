import { afterEach, describe, expect, test, vi } from 'vitest'
import type { panel_ai_action } from '@yuebot/shared'

import {
  can_apply_panel_ai_action,
  confirm_panel_ai_server_apply,
  prepare_panel_ai_server_apply,
} from './server_apply'

afterEach(() => {
  vi.unstubAllGlobals()
})

function settingsAction(): Extract<panel_ai_action, { type: 'prefill_form' }> {
  return {
    id: 'action-1',
    type: 'prefill_form',
    pageKey: 'settings',
    label: 'Preparar alteração',
    changes: [{ target: 'locale', targetLabel: 'Idioma', value: 'en-US' }],
  }
}

describe('Panel AI server apply client', () => {
  test('only server-apply pages are eligible', () => {
    expect(can_apply_panel_ai_action(settingsAction())).toBe(true)
    expect(can_apply_panel_ai_action({
      ...settingsAction(),
      pageKey: 'welcome',
      changes: [{ target: 'welcomeMessage', targetLabel: 'Mensagem de boas-vindas', value: 'Olá' }],
    })).toBe(false)
  })

  test('prepare sends only the fixed page and target/value change set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        noop: false,
        proposal: {
          id: 'proposal-1',
          pageKey: 'settings',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          changes: [{ target: 'locale', targetLabel: 'Idioma', before: 'pt-BR', after: 'en-US' }],
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await prepare_panel_ai_server_apply('guild-1', settingsAction())
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/guilds/guild-1/panel-ai/apply-proposals')
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      pageKey: 'settings',
      changes: [{ target: 'locale', value: 'en-US' }],
    })
  })

  test('rejects malformed server proposals instead of trusting response data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        noop: false,
        proposal: {
          id: 'proposal-1',
          pageKey: 'settings',
          expiresAt: new Date().toISOString(),
          changes: [{ target: 'locale', targetLabel: 'Idioma', before: { secret: true }, after: 'en-US' }],
        },
      }),
    }))

    expect(await prepare_panel_ai_server_apply('guild-1', settingsAction())).toEqual({
      ok: false,
      status: 502,
      error: 'Invalid apply proposal response',
    })
  })

  test('confirm uses only the opaque proposal id and validates the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: {
          proposalId: 'proposal-1',
          pageKey: 'settings',
          appliedAt: new Date().toISOString(),
          replayed: false,
          changes: [{ target: 'locale', targetLabel: 'Idioma', before: 'pt-BR', after: 'en-US' }],
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await confirm_panel_ai_server_apply('guild-1', 'proposal-1')
    expect(result.ok).toBe(true)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/apply-proposals/proposal-1/confirm')
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{}')
  })
})
