import * as React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { panel_ai_action } from '@yuebot/shared'

import { MessageVariantEditor } from '../message_variant_editor'
import { Input, Select, Switch } from '../ui'
import { apply_panel_ai_prefill_action } from './prefill'

type prefill_action = Extract<panel_ai_action, { type: 'prefill_form' }>

function action(pageKey: prefill_action['pageKey'], changes: prefill_action['changes']): prefill_action {
  return {
    id: 'prefill-test',
    type: 'prefill_form',
    pageKey,
    changes,
    label: 'Preparar alterações',
  }
}

describe('Panel AI local prefill', () => {
  test('refuses to touch controls when the user is no longer on the proposed page', async () => {
    function Harness() {
      const [value, setValue] = React.useState(70)
      return (
        <div>
          <div>Limite de CAPS (%)</div>
          <Input value={String(value)} onChange={(event) => setValue(Number(event.target.value))} />
        </div>
      )
    }

    render(<Harness />)
    let result!: Awaited<ReturnType<typeof apply_panel_ai_prefill_action>>
    await act(async () => {
      result = await apply_panel_ai_prefill_action(
        action('automod', [{ target: 'capsThreshold', targetLabel: 'Limite de CAPS (%)', value: 80 }]),
        'settings',
      )
    })

    expect(result).toEqual({ applied: 0, failed: 1, reason: 'wrong-page' })
    expect(screen.getByDisplayValue('70')).toBeInTheDocument()
  })

  test('applies switches before conditionally rendered numeric controls', async () => {
    function Harness() {
      const [enabled, setEnabled] = React.useState(false)
      const [rate, setRate] = React.useState(10)
      return (
        <div>
          <Switch checked={enabled} onCheckedChange={setEnabled} label="Voice XP habilitado" />
          {enabled ? (
            <div>
              <div>Pontos a cada 10 minutos (Voice Rate)</div>
              <Input value={String(rate)} onChange={(event) => setRate(Number(event.target.value))} />
            </div>
          ) : null}
          <output data-testid="rate">{rate}</output>
        </div>
      )
    }

    render(<Harness />)
    let result!: Awaited<ReturnType<typeof apply_panel_ai_prefill_action>>
    await act(async () => {
      result = await apply_panel_ai_prefill_action(
        action('xp', [
          { target: 'voiceXpRate', targetLabel: 'Pontos a cada 10 minutos (Voice Rate)', value: 25 },
          { target: 'voiceXpEnabled', targetLabel: 'Ativar Voice XP (Voz)', value: true },
        ]),
        'xp',
      )
    })

    expect(result).toEqual({ applied: 2, failed: 0 })
    expect(screen.getByRole('switch', { name: 'Voice XP habilitado' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('rate')).toHaveTextContent('25')
  })

  test('selects only an allowlisted enum option through the existing Select control', async () => {
    function Harness() {
      const [locale, setLocale] = React.useState('pt-BR')
      return (
        <div>
          <div>Idioma</div>
          <Select value={locale} onValueChange={setLocale}>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English (US)</option>
            <option value="es-ES">Español</option>
          </Select>
          <output data-testid="locale">{locale}</output>
        </div>
      )
    }

    render(<Harness />)
    let result!: Awaited<ReturnType<typeof apply_panel_ai_prefill_action>>
    await act(async () => {
      result = await apply_panel_ai_prefill_action(
        action('settings', [{ target: 'locale', targetLabel: 'Idioma', value: 'en-US' }]),
        'settings',
      )
    })

    expect(result).toEqual({ applied: 1, failed: 0 })
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US')
  })

  test('replaces a welcome message through the editor advanced mode without saving anything', async () => {
    function Harness() {
      const [value, setValue] = React.useState('Mensagem antiga')
      return (
        <div>
          <MessageVariantEditor
            label="Mensagem de boas-vindas"
            value={value}
            onChange={setValue}
          />
          <output data-testid="message-value">{value}</output>
        </div>
      )
    }

    render(<Harness />)
    const proposed = 'Bem-vindo {@user} ao {guild}!'
    let result!: Awaited<ReturnType<typeof apply_panel_ai_prefill_action>>
    await act(async () => {
      result = await apply_panel_ai_prefill_action(
        action('welcome', [
          { target: 'welcomeMessage', targetLabel: 'Mensagem de boas-vindas', value: proposed },
        ]),
        'welcome',
      )
    })

    expect(result).toEqual({ applied: 1, failed: 0 })
    expect(screen.getByTestId('message-value')).toHaveTextContent(proposed)
  })
})
