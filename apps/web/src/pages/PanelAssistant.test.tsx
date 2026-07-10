import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import PanelAssistantPage from './PanelAssistant'

let mockGuildId: string | undefined = 'guild-1'
vi.mock('react-router-dom', () => ({
  useParams: () => ({ guildId: mockGuildId }),
}))

vi.mock('../env', () => ({ getApiUrl: () => 'http://localhost:3000' }))
vi.mock('../store/toast', () => ({ toast_success: vi.fn(), toast_error: vi.fn() }))

const mockFetch = vi.fn()
window.fetch = mockFetch as unknown as typeof window.fetch

type deferred_value<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): deferred_value<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolver) => { resolve = resolver })
  return { promise, resolve }
}

function makeResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) }
}

function historyResponse(messages: unknown[] = []) {
  return makeResponse({ success: true, messages })
}

async function renderWithHistory(messages: unknown[] = []) {
  mockFetch.mockResolvedValueOnce(historyResponse(messages))
  const result = render(<PanelAssistantPage />)
  await waitFor(() => expect(screen.queryByLabelText('Carregando histórico')).not.toBeInTheDocument())
  return result
}

describe('PanelAssistantPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockGuildId = 'guild-1'
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
    Element.prototype.scrollIntoView = vi.fn()
  })

  test('shows history loading state until the request resolves', async () => {
    const request = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockReturnValueOnce(request.promise)
    render(<PanelAssistantPage />)

    expect(screen.getByLabelText('Carregando histórico')).toBeInTheDocument()
    await act(async () => request.resolve(historyResponse()))
    await waitFor(() => expect(screen.queryByLabelText('Carregando histórico')).not.toBeInTheDocument())
  })

  test('hydrates valid history', async () => {
    await renderWithHistory([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ])
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  test('shows the generic history error when fetch rejects', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<PanelAssistantPage />)

    expect(await screen.findByText('Não foi possível carregar o histórico.')).toBeInTheDocument()
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()
  })

  test.each<unknown[][]>([
    [[{ role: 'system', content: 'unsafe' }]],
    [[{ role: 'assistant', content: null }]],
    [[{ role: 'assistant', content: 'ok', _error: true }]],
  ])('rejects malformed API history entries', async (messages) => {
    mockFetch.mockResolvedValueOnce(historyResponse(messages))
    render(<PanelAssistantPage />)
    expect(await screen.findByText('Não foi possível carregar o histórico.')).toBeInTheDocument()
    expect(screen.queryByText('unsafe')).not.toBeInTheDocument()
  })

  test('ignores an old history response resolved after the new guild response', async () => {
    const oldRequest = deferred<ReturnType<typeof makeResponse>>()
    const newRequest = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise)
    mockGuildId = 'guild-old'
    const { rerender } = render(<PanelAssistantPage />)

    mockGuildId = 'guild-new'
    rerender(<PanelAssistantPage />)
    expect(screen.queryByText('old content')).not.toBeInTheDocument()

    await act(async () => newRequest.resolve(historyResponse([{ role: 'user', content: 'new content' }])))
    expect(await screen.findByText('new content')).toBeInTheDocument()

    await act(async () => oldRequest.resolve(historyResponse([{ role: 'user', content: 'old content' }])))
    await act(async () => Promise.resolve())
    expect(screen.queryByText('old content')).not.toBeInTheDocument()
    expect(screen.getByText('new content')).toBeInTheDocument()
  })

  test('manual send renders optimistic user and thinking states, then the response', async () => {
    const chatRequest = deferred<ReturnType<typeof makeResponse>>()
    await renderWithHistory()
    mockFetch.mockReturnValueOnce(chatRequest.promise)

    await userEvent.type(screen.getByLabelText('Campo de mensagem'), 'Hello Ella')
    await userEvent.click(screen.getByLabelText('Enviar mensagem'))
    expect(screen.getByText('Hello Ella')).toBeInTheDocument()
    expect(screen.getByText('Ella está pensando')).toBeInTheDocument()

    await act(async () => chatRequest.resolve(makeResponse({ response: 'Hello human' })))
    expect(await screen.findByText('Hello human')).toBeInTheDocument()
    expect(screen.queryByText('Ella está pensando')).not.toBeInTheDocument()
  })

  test('renders one retryable error after a failed send', async () => {
    await renderWithHistory()
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Try later' }, false))
    await userEvent.type(screen.getByLabelText('Campo de mensagem'), 'Question')
    await userEvent.click(screen.getByLabelText('Enviar mensagem'))

    expect(await screen.findByText('Try later')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Tentar novamente' })).toHaveLength(1)
  })

  test('retry succeeds without duplicating the user message', async () => {
    await renderWithHistory()
    mockFetch
      .mockResolvedValueOnce(makeResponse({ error: 'Try later' }, false))
      .mockResolvedValueOnce(makeResponse({ response: 'Recovered' }))
    await userEvent.type(screen.getByLabelText('Campo de mensagem'), 'Question')
    await userEvent.click(screen.getByLabelText('Enviar mensagem'))
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Recovered')).toBeInTheDocument()
    expect(screen.getAllByText('Question')).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  test('retry failure restores exactly one retryable error', async () => {
    await renderWithHistory()
    mockFetch
      .mockResolvedValueOnce(makeResponse({ error: 'First failure' }, false))
      .mockResolvedValueOnce(makeResponse({ error: 'Still failing' }, false))
    await userEvent.type(screen.getByLabelText('Campo de mensagem'), 'Question')
    await userEvent.click(screen.getByLabelText('Enviar mensagem'))
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Still failing')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Tentar novamente' })).toHaveLength(1)
    expect(screen.getAllByText('Question')).toHaveLength(1)
  })

  test('repeated retry clicks produce one retry request and block clear', async () => {
    const retryRequest = deferred<ReturnType<typeof makeResponse>>()
    await renderWithHistory()
    mockFetch
      .mockResolvedValueOnce(makeResponse({ error: 'Try later' }, false))
      .mockReturnValueOnce(retryRequest.promise)
    await userEvent.type(screen.getByLabelText('Campo de mensagem'), 'Question')
    await userEvent.click(screen.getByLabelText('Enviar mensagem'))
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    await Promise.all([userEvent.click(retry), userEvent.click(retry)])

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('button', { name: /Nova conversa indisponível/ })).toBeDisabled()
    await act(async () => retryRequest.resolve(makeResponse({ response: 'Done' })))
  })

  test('guild change aborts and ignores an in-flight send completion', async () => {
    const oldChat = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse())
    const { rerender } = render(<PanelAssistantPage />)
    await waitFor(() => expect(screen.queryByLabelText('Carregando histórico')).not.toBeInTheDocument())
    mockFetch.mockReturnValueOnce(oldChat.promise).mockResolvedValueOnce(historyResponse())
    await userEvent.type(screen.getByLabelText('Campo de mensagem'), 'From guild A')
    await userEvent.click(screen.getByLabelText('Enviar mensagem'))

    mockGuildId = 'guild-2'
    rerender(<PanelAssistantPage />)
    await waitFor(() => expect(screen.queryByLabelText('Carregando histórico')).not.toBeInTheDocument())
    await act(async () => oldChat.resolve(makeResponse({ response: 'Guild A response' })))
    await act(async () => Promise.resolve())
    expect(document.body.textContent).not.toContain('Guild A response')
  })

  test('quick prompt submits its exact visible text once', async () => {
    await renderWithHistory()
    mockFetch.mockResolvedValueOnce(makeResponse({ response: 'Answer' }))
    const prompt = screen.getByRole('button', { name: 'Como funciona o Anti-Raide?' })
    await userEvent.click(prompt)

    await waitFor(() => expect(mockFetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/panel-ai/chat'),
      expect.objectContaining({ body: JSON.stringify({ message: 'Como funciona o Anti-Raide?' }) })
    ))
    expect(screen.getAllByText('Como funciona o Anti-Raide?')).toHaveLength(1)
  })

  test('clear success removes messages and restores composer focus', async () => {
    await renderWithHistory([{ role: 'user', content: 'Keep me until success' }])
    mockFetch.mockResolvedValueOnce(makeResponse({ success: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/Tem certeza/)
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar' }))

    await waitFor(() => expect(screen.queryByText('Keep me until success')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Campo de mensagem')).toHaveFocus()
  })

  test('clear failure preserves every message', async () => {
    await renderWithHistory([{ role: 'user', content: 'Keep me' }])
    mockFetch.mockResolvedValueOnce(makeResponse({}, false))
    await userEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar' }))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Keep me')).toBeInTheDocument()
  })

  test('a stale chat completion cannot recreate content after clearing the new guild', async () => {
    const oldChat = deferred<ReturnType<typeof makeResponse>>()
    mockFetch
      .mockResolvedValueOnce(historyResponse())
      .mockReturnValueOnce(oldChat.promise)
      .mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Guild B message' }]))
      .mockResolvedValueOnce(makeResponse({ success: true }))
    mockGuildId = 'guild-a'
    const { rerender } = render(<PanelAssistantPage />)
    await waitFor(() => expect(screen.queryByLabelText('Carregando histórico')).not.toBeInTheDocument())
    await userEvent.type(screen.getByLabelText('Campo de mensagem'), 'Guild A question')
    await userEvent.click(screen.getByLabelText('Enviar mensagem'))
    mockGuildId = 'guild-b'
    rerender(<PanelAssistantPage />)
    await screen.findByText('Guild B message')
    await userEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Encerrar' }))
    await act(async () => oldChat.resolve(makeResponse({ response: 'Late response' })))
    expect(screen.queryByText('Late response')).not.toBeInTheDocument()
  })

  test('successful send restores focus and local turns scroll the conversation sentinel', async () => {
    await renderWithHistory()
    mockFetch.mockResolvedValueOnce(makeResponse({ response: 'Answer' }))
    const composer = screen.getByLabelText('Campo de mensagem')
    await userEvent.type(composer, 'Question')
    await userEvent.click(screen.getByLabelText('Enviar mensagem'))

    await screen.findByText('Answer')
    expect(composer).toHaveFocus()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  test('Escape closes the clear alert dialog and restores trigger focus', async () => {
    await renderWithHistory([{ role: 'user', content: 'Message' }])
    const trigger = screen.getByRole('button', { name: 'Nova conversa' })
    await userEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  test('clear alert dialog traps keyboard focus within its actions', async () => {
    await renderWithHistory([{ role: 'user', content: 'Message' }])
    await userEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    const cancel = screen.getByRole('button', { name: 'Cancelar' })
    const confirm = screen.getByRole('button', { name: 'Encerrar' })
    expect(cancel).toHaveFocus()
    await userEvent.tab()
    expect(confirm).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(cancel).toHaveFocus()
  })
})
