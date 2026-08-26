import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { panel_ai_action } from '@yuebot/shared'

import { PanelAssistantMessage } from './PanelAssistantMessage'
import { toast_success } from '../../store/toast'

vi.mock('../../store/toast', () => ({
  toast_success: vi.fn(),
  toast_error: vi.fn(),
}))

function renderMessage(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
}

describe('PanelAssistantMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/guild/guild-1/settings')
  })

  test('renders user message', () => {
    renderMessage(<PanelAssistantMessage role="user" content="Hello" />)
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  test('renders assistant message with markdown', () => {
    const { container } = renderMessage(<PanelAssistantMessage role="assistant" content="**bold** and *italic*" />)
    expect(container.querySelector('strong')).toBeTruthy()
    expect(container.querySelector('em')).toBeTruthy()
  })

  test('renders thinking indicator', () => {
    const { container } = renderMessage(<PanelAssistantMessage role="thinking" content="" />)
    expect(screen.getByText(/Ella está pensando/i)).toBeTruthy()
    expect(container.querySelectorAll('.motion-reduce\\:animate-none')).toHaveLength(3)
  })

  test('renders error with retry button', () => {
    const onRetry = vi.fn()
    renderMessage(<PanelAssistantMessage role="error" content="Failed" onRetry={onRetry} isError />)
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.getByText('Tentar novamente')).toBeTruthy()
  })

  test('copy button calls clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    renderMessage(<PanelAssistantMessage role="assistant" content="Hello world" />)
    const copyBtn = screen.getByLabelText('Copiar resposta')
    await userEvent.click(copyBtn)
    expect(writeText).toHaveBeenCalledWith('Hello world')
    expect(toast_success).toHaveBeenCalledWith('Resposta copiada.', 'Ella')
  })

  test('server apply shows a server-calculated diff and persists only after explicit confirmation', async () => {
    const action: panel_ai_action = {
      id: 'prefill-1',
      type: 'prefill_form',
      pageKey: 'settings',
      label: 'Preparar alteração',
      changes: [
        { target: 'locale', targetLabel: 'Idioma', value: 'en-US' },
      ],
    }

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          noop: false,
          proposal: {
            id: 'proposal-1',
            pageKey: 'settings',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            changes: [
              { target: 'locale', targetLabel: 'Idioma', before: 'pt-BR', after: 'en-US' },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: {
            proposalId: 'proposal-1',
            pageKey: 'settings',
            appliedAt: new Date().toISOString(),
            replayed: false,
            changes: [
              { target: 'locale', targetLabel: 'Idioma', before: 'pt-BR', after: 'en-US' },
            ],
          },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    renderMessage(
      <PanelAssistantMessage
        role="assistant"
        content="Posso ajustar o idioma."
        actions={[action]}
        onAction={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Aplicar no servidor' }))

    expect(await screen.findByRole('group', { name: 'Confirmação de alterações da Ella' })).toBeTruthy()
    expect(screen.getByText('pt-BR')).toBeTruthy()
    expect(screen.getByText('en-US')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const prepareBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(prepareBody).toEqual({
      pageKey: 'settings',
      changes: [{ target: 'locale', value: 'en-US' }],
    })

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e salvar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aplicado' })).toBeDisabled())
    expect(toast_success).toHaveBeenCalledWith('Alteração aplicada e salva no servidor.', 'Ella')
  })

  test('server apply works from the Ella page for a different configuration page', async () => {
    window.history.pushState({}, '', '/guild/guild-1/assistant')
    const action: panel_ai_action = {
      id: 'prefill-ai-moderation',
      type: 'prefill_form',
      pageKey: 'automod',
      label: 'Preparar 2 alterações',
      changes: [
        { target: 'aiModerationEnabled', targetLabel: 'Moderação por IA', value: true },
        { target: 'aiModerationLevel', targetLabel: 'Nível de detecção', value: 'permissivo' },
      ],
    }

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          noop: false,
          proposal: {
            id: 'proposal-ai-moderation',
            pageKey: 'automod',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            changes: [
              { target: 'aiModerationEnabled', targetLabel: 'Moderação por IA', before: false, after: true },
              { target: 'aiModerationLevel', targetLabel: 'Nível de detecção', before: 'medio', after: 'permissivo' },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: {
            proposalId: 'proposal-ai-moderation',
            pageKey: 'automod',
            appliedAt: new Date().toISOString(),
            replayed: false,
            changes: [
              { target: 'aiModerationEnabled', targetLabel: 'Moderação por IA', before: false, after: true },
              { target: 'aiModerationLevel', targetLabel: 'Nível de detecção', before: 'medio', after: 'permissivo' },
            ],
          },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    renderMessage(
      <PanelAssistantMessage
        role="assistant"
        content="Posso ativar e deixar no permissivo."
        actions={[action]}
        onAction={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Aplicar no servidor' }))
    expect(await screen.findByRole('group', { name: 'Confirmação de alterações da Ella' })).toBeTruthy()
    expect(screen.getByText('Desativado')).toBeTruthy()
    expect(screen.getByText('Ativado')).toBeTruthy()
    expect(screen.getByText('medio')).toBeTruthy()
    expect(screen.getByText('permissivo')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e salvar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aplicado' })).toBeDisabled())
    expect(window.location.pathname).toBe('/guild/guild-1/assistant')
    expect(toast_success).toHaveBeenCalledWith('2 alterações aplicadas e salvas no servidor.', 'Ella')
  })
})
