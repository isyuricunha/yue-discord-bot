import * as React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  getPanelAssistantGuildId,
  PanelAssistantProvider,
  usePanelAssistantContext,
} from './PanelAssistantProvider'
import { toast_error, toast_success } from '../../store/toast'

vi.mock('../../env', () => ({ getApiUrl: () => 'http://localhost:3000' }))
vi.mock('../../store/toast', () => ({ toast_success: vi.fn(), toast_error: vi.fn() }))

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

function Consumer({ name }: { name: string }) {
  const assistant = usePanelAssistantContext()
  return (
    <section data-testid={`consumer-${name}`}>
      <span data-testid="guild">{assistant.activeGuildId ?? 'none'}</span>
      <span data-testid="operation">{assistant.operation}</span>
      <span data-testid="error">{assistant.historyError ?? 'none'}</span>
      <span data-testid="scroll-version">{assistant.scrollVersion}</span>
      <span data-testid="focus-version">{assistant.focusVersion}</span>
      <span data-testid="messages">
        {assistant.messages.map((message) => `${message.content}:${message.status}`).join('|')}
      </span>
      <input
        aria-label={`Draft ${name}`}
        value={assistant.draft}
        onChange={(event) => assistant.setDraft(event.target.value)}
      />
      <button type="button" onClick={() => assistant.send()}>Send {name}</button>
      <button type="button" onClick={() => {
        const errMessage = assistant.messages.find((m) => m.status === 'error')
        if (errMessage) assistant.retry(errMessage.turnId)
      }}>Retry {name}</button>
      <button type="button" onClick={() => void assistant.clearConversation()}>Clear {name}</button>
    </section>
  )
}

let navigateTo: ReturnType<typeof useNavigate>

function NavigationController() {
  navigateTo = useNavigate()
  return null
}

function renderProvider(path = '/guild/123/assistant', children?: React.ReactNode, strict = false) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <PanelAssistantProvider>
        <NavigationController />
        {children ?? <><Consumer name="A" /><Consumer name="B" /></>}
      </PanelAssistantProvider>
    </MemoryRouter>
  )
  return render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree)
}

function getConsumer(name: string) {
  return within(screen.getByTestId(`consumer-${name}`))
}

describe('PanelAssistantProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  test.each([
    ['/guild/123', '123'],
    ['/guild/123/automod', '123'],
    ['/guild/123/assistant', '123'],
    ['/guild/456/music', '456'],
    ['/owner', undefined],
    ['/badges', undefined],
    ['/', undefined],
    ['/guild//assistant', undefined],
  ])('resolves the active guild from %s', (pathname, expected) => {
    expect(getPanelAssistantGuildId(pathname)).toBe(expected)
  })

  test('fails clearly when the context hook is used outside the provider', () => {
    function OutsideConsumer() {
      usePanelAssistantContext()
      return null
    }
    expect(() => render(
      <MemoryRouter><OutsideConsumer /></MemoryRouter>
    )).toThrow('usePanelAssistantContext must be used within PanelAssistantProvider')
  })

  test('two consumers share hydration, draft, operations, optimistic turns, and responses', async () => {
    const chatRequest = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse([{ role: 'assistant', content: 'Hydrated' }]))
    renderProvider()

    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Hydrated:complete'))
    expect(getConsumer('B').getByTestId('messages')).toHaveTextContent('Hydrated:complete')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Shared question')
    expect(getConsumer('B').getByLabelText('Draft B')).toHaveValue('Shared question')

    mockFetch.mockReturnValueOnce(chatRequest.promise)
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))
    expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('sending')
    expect(getConsumer('B').getByTestId('operation')).toHaveTextContent('sending')
    expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Shared question:complete')
    expect(getConsumer('B').getByTestId('messages')).toHaveTextContent(':thinking')

    await act(async () => chatRequest.resolve(makeResponse({ response: 'Shared answer' })))
    await waitFor(() => expect(getConsumer('B').getByTestId('messages')).toHaveTextContent('Shared answer:complete'))
    expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle')
  })

  test('two consumers share history errors and clearing', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const view = renderProvider()
    await waitFor(() => expect(getConsumer('A').getByTestId('error')).toHaveTextContent('Não foi possível carregar o histórico.'))
    expect(getConsumer('B').getByTestId('error')).toHaveTextContent('Não foi possível carregar o histórico.')
    view.unmount()

    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Clear me' }]))
      .mockResolvedValueOnce(makeResponse({ success: true }))
    renderProvider()
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Clear me'))
    await userEvent.click(getConsumer('B').getByRole('button', { name: 'Clear B' }))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toBeEmptyDOMElement())
    expect(getConsumer('B').getByTestId('messages')).toBeEmptyDOMElement()
  })

  test('Strict Mode mounts two consumers with only one history request', async () => {
    mockFetch.mockResolvedValueOnce(historyResponse())
    renderProvider('/guild/123/assistant', undefined, true)
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('same-guild navigation preserves state and different or absent guild resets it', async () => {
    mockFetch
      .mockResolvedValueOnce(historyResponse([{ role: 'assistant', content: 'Guild 123 history' }]))
      .mockResolvedValueOnce(historyResponse([{ role: 'assistant', content: 'Guild 456 history' }]))
      .mockResolvedValueOnce(historyResponse([{ role: 'assistant', content: 'Guild 123 rehydrated' }]))
    renderProvider('/guild/123/automod')
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Guild 123 history'))
    await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Preserved draft')

    await act(async () => navigateTo('/guild/123/music'))
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(getConsumer('B').getByLabelText('Draft B')).toHaveValue('Preserved draft')
    expect(getConsumer('B').getByTestId('messages')).toHaveTextContent('Guild 123 history')

    await act(async () => navigateTo('/guild/456/music'))
    expect(getConsumer('A').getByLabelText('Draft A')).toHaveValue('')
    expect(getConsumer('A').getByTestId('messages')).not.toHaveTextContent('Guild 123 history')
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Guild 456 history'))
    expect(mockFetch).toHaveBeenCalledTimes(2)

    await act(async () => navigateTo('/owner'))
    expect(getConsumer('A').getByTestId('guild')).toHaveTextContent('none')
    expect(getConsumer('A').getByTestId('messages')).toBeEmptyDOMElement()
    expect(mockFetch).toHaveBeenCalledTimes(2)

    await act(async () => navigateTo('/guild/123/assistant'))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Guild 123 rehydrated'))
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  test('same-guild navigation preserves an in-flight send without aborting it', async () => {
    const chatRequest = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse()).mockReturnValueOnce(chatRequest.promise)
    renderProvider('/guild/123/automod')
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Question in progress')
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))
    const signal = mockFetch.mock.calls[1]?.[1]?.signal as AbortSignal

    await act(async () => navigateTo('/guild/123/music'))
    expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('sending')
    expect(getConsumer('B').getByTestId('messages')).toHaveTextContent('Question in progress')
    expect(signal.aborted).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    await act(async () => chatRequest.resolve(makeResponse({ response: 'Completed on sibling route' })))
    await waitFor(() => expect(getConsumer('B').getByTestId('messages')).toHaveTextContent('Completed on sibling route'))
  })

  test('a late history response from the previous guild is ignored', async () => {
    const oldHistory = deferred<ReturnType<typeof makeResponse>>()
    const newHistory = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockReturnValueOnce(oldHistory.promise).mockReturnValueOnce(newHistory.promise)
    renderProvider('/guild/123/assistant')
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    await act(async () => navigateTo('/guild/456/assistant'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    await act(async () => newHistory.resolve(historyResponse([{ role: 'assistant', content: 'Fresh' }])))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Fresh'))
    await act(async () => oldHistory.resolve(historyResponse([{ role: 'assistant', content: 'Stale' }])))
    expect(getConsumer('A').getByTestId('messages')).not.toHaveTextContent('Stale')
  })

  test('same-guild navigation does not abort a valid clear request', async () => {
    const clearRequest = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Message' }]))
      .mockReturnValueOnce(clearRequest.promise)
    renderProvider('/guild/123/assistant')
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Clear A' }))
    const signal = mockFetch.mock.calls[1]?.[1]?.signal as AbortSignal

    await act(async () => navigateTo('/guild/123/music'))
    expect(signal.aborted).toBe(false)
    expect(getConsumer('B').getByTestId('operation')).toHaveTextContent('clearing')
    await act(async () => clearRequest.resolve(makeResponse({ success: true })))
    await waitFor(() => expect(getConsumer('B').getByTestId('operation')).toHaveTextContent('idle'))
  })

  test('leaving a guild aborts a pending clear and emits no stale toast', async () => {
    const clearRequest = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Message' }]))
      .mockReturnValueOnce(clearRequest.promise)
    renderProvider()
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Clear A' }))
    const signal = mockFetch.mock.calls[1]?.[1]?.signal as AbortSignal

    await act(async () => navigateTo('/owner'))
    expect(signal.aborted).toBe(true)
    await act(async () => clearRequest.resolve(makeResponse({ success: true })))
    expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle')
    expect(toast_success).not.toHaveBeenCalled()
    expect(toast_error).not.toHaveBeenCalled()
  })

  test('A to non-guild to A ignores the old clear after fresh history hydrates', async () => {
    const oldClear = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Old A' }]))
      .mockReturnValueOnce(oldClear.promise)
      .mockResolvedValueOnce(historyResponse([{ role: 'assistant', content: 'Fresh A' }]))
    renderProvider('/guild/A/assistant')
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Old A'))
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Clear A' }))

    await act(async () => navigateTo('/owner'))
    await act(async () => navigateTo('/guild/A/assistant'))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Fresh A'))
    await act(async () => oldClear.resolve(makeResponse({ success: true })))

    expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Fresh A')
    expect(toast_success).not.toHaveBeenCalled()
    expect(toast_error).not.toHaveBeenCalled()
  })

  test('a stale clear cannot set idle during a newer history load', async () => {
    const oldClear = deferred<ReturnType<typeof makeResponse>>()
    const newHistory = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Old A' }]))
      .mockReturnValueOnce(oldClear.promise)
      .mockReturnValueOnce(newHistory.promise)
    renderProvider('/guild/A/assistant')
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Clear A' }))

    await act(async () => navigateTo('/owner'))
    await act(async () => navigateTo('/guild/A/assistant'))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3))
    expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('loading-history')
    await act(async () => oldClear.resolve(makeResponse({}, false)))
    expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('loading-history')
    expect(toast_success).not.toHaveBeenCalled()
    expect(toast_error).not.toHaveBeenCalled()

    await act(async () => newHistory.resolve(historyResponse()))
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
  })

  test('A to B to A prevents an old clear from disrupting a newer chat', async () => {
    const oldClear = deferred<ReturnType<typeof makeResponse>>()
    const newChat = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Old A' }]))
      .mockReturnValueOnce(oldClear.promise)
      .mockResolvedValueOnce(historyResponse([{ role: 'assistant', content: 'Guild B' }]))
      .mockResolvedValueOnce(historyResponse([{ role: 'assistant', content: 'Fresh A' }]))
      .mockReturnValueOnce(newChat.promise)
    renderProvider('/guild/A/assistant')
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Old A'))
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Clear A' }))

    await act(async () => navigateTo('/guild/B/assistant'))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Guild B'))
    await act(async () => navigateTo('/guild/A/assistant'))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Fresh A'))
    await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'New A question')
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))
    expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('sending')
    const scrollBeforeStaleClear = getConsumer('A').getByTestId('scroll-version').textContent
    const focusBeforeStaleClear = getConsumer('A').getByTestId('focus-version').textContent

    await act(async () => oldClear.resolve(makeResponse({ success: true })))
    expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('sending')
    expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Fresh A')
    expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('New A question')
    expect(getConsumer('A').getByTestId('scroll-version')).toHaveTextContent(scrollBeforeStaleClear ?? '')
    expect(getConsumer('A').getByTestId('focus-version')).toHaveTextContent(focusBeforeStaleClear ?? '')
    expect(toast_success).not.toHaveBeenCalled()
    expect(toast_error).not.toHaveBeenCalled()

    await act(async () => newChat.resolve(makeResponse({ response: 'New A answer' })))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('New A answer'))
  })

  test('focus and scroll event counters remain monotonic across guild changes', async () => {
    mockFetch.mockResolvedValueOnce(historyResponse())
      .mockResolvedValueOnce(makeResponse({ response: 'First answer' }))
      .mockResolvedValueOnce(historyResponse())
      .mockResolvedValueOnce(historyResponse())
      .mockResolvedValueOnce(makeResponse({ response: 'Second answer' }))
    renderProvider('/guild/A/assistant')
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'First question')
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('First answer'))
    const scrollAfterFirstSend = Number(getConsumer('A').getByTestId('scroll-version').textContent)
    const focusAfterFirstSend = Number(getConsumer('A').getByTestId('focus-version').textContent)

    await act(async () => navigateTo('/guild/B/assistant'))
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    expect(Number(getConsumer('A').getByTestId('scroll-version').textContent)).toBe(scrollAfterFirstSend)
    expect(Number(getConsumer('A').getByTestId('focus-version').textContent)).toBe(focusAfterFirstSend)
    await act(async () => navigateTo('/guild/A/assistant'))
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    expect(Number(getConsumer('A').getByTestId('scroll-version').textContent)).toBe(scrollAfterFirstSend)
    expect(Number(getConsumer('A').getByTestId('focus-version').textContent)).toBe(focusAfterFirstSend)

    await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Second question')
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))
    await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Second answer'))
    expect(Number(getConsumer('A').getByTestId('scroll-version').textContent)).toBe(scrollAfterFirstSend + 2)
    expect(Number(getConsumer('A').getByTestId('focus-version').textContent)).toBe(focusAfterFirstSend + 1)
  })

  test('provider unmount aborts history and ignores its late response', async () => {
    const historyRequest = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockReturnValueOnce(historyRequest.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const view = renderProvider()
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const signal = mockFetch.mock.calls[0]?.[1]?.signal as AbortSignal

    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => historyRequest.resolve(historyResponse([{ role: 'assistant', content: 'Late' }])))
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  test('provider unmount aborts chat and ignores its late response', async () => {
    const chatRequest = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse()).mockReturnValueOnce(chatRequest.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const view = renderProvider()
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Pending question')
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))
    const signal = mockFetch.mock.calls[1]?.[1]?.signal as AbortSignal

    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => chatRequest.resolve(makeResponse({ response: 'Late response' })))
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  test('provider unmount aborts a pending clear request without toasts', async () => {
    const clearRequest = deferred<ReturnType<typeof makeResponse>>()
    mockFetch.mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Message' }]))
      .mockReturnValueOnce(clearRequest.promise)
    const view = renderProvider()
    await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
    await userEvent.click(getConsumer('A').getByRole('button', { name: 'Clear A' }))
    const signal = mockFetch.mock.calls[1]?.[1]?.signal as AbortSignal

    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => clearRequest.resolve(makeResponse({ success: true })))
    expect(toast_success).not.toHaveBeenCalled()
    expect(toast_error).not.toHaveBeenCalled()
  })

  describe('Page awareness request lifecycle and same-guild navigation', () => {
    test('sends correct pageContext in request bodies', async () => {
      mockFetch.mockResolvedValue(historyResponse())

      const testCases = [
        { path: '/guild/123/automod', expectedPageKey: 'automod' },
        { path: '/guild/123/music', expectedPageKey: 'music' },
        { path: '/guild/123/assistant', expectedPageKey: 'assistant' },
        { path: '/guild/123', expectedPageKey: 'guild-root' },
        { path: '/guild/123/nonexistent-route', expectedPageKey: undefined },
      ]

      for (const tc of testCases) {
        mockFetch.mockClear()
        mockFetch.mockResolvedValueOnce(historyResponse()).mockResolvedValueOnce(makeResponse({ response: 'Reply' }))

        const { unmount } = renderProvider(tc.path)
        try {
          await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))

          await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Test message')
          await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))

          await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))

          const lastCall = mockFetch.mock.calls.find(call => call[0].includes('/panel-ai/chat'))
          expect(lastCall).toBeDefined()
          if (!lastCall || !lastCall[1]) throw new Error('lastCall payload missing')
          const body = JSON.parse(lastCall[1].body)
          expect(body.message).toBe('Test message')

          if (tc.expectedPageKey) {
            expect(body.pageContext).toEqual({ pageKey: tc.expectedPageKey })
          } else {
            expect(body.pageContext).toBeUndefined()
          }

          // Verify no pathname, query, hash, guild ID, dynamic ID, form value, or DOM data is included
          const keys = Object.keys(body)
          expect(keys).toContain('message')
          if (tc.expectedPageKey) {
            expect(keys).toContain('pageContext')
            expect(Object.keys(body.pageContext)).toEqual(['pageKey'])
            expect(keys.length).toBe(2)
          } else {
            expect(keys.length).toBe(1)
          }
        } finally {
          unmount()
        }
      }
    })

    test('retains context and prevents abort on same-guild navigation', async () => {
      const chatRequest = deferred<ReturnType<typeof makeResponse>>()
      mockFetch
        .mockResolvedValueOnce(historyResponse()) // initial automod history
        .mockReturnValueOnce(chatRequest.promise) // automod chat request

      renderProvider('/guild/123/automod')
      await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))

      await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Question 1')
      await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))

      // Navigate to music before it resolves
      await act(async () => navigateTo('/guild/123/music'))

      const chatCall = mockFetch.mock.calls.find(c => c[0].includes('/panel-ai/chat'))
      expect(chatCall).toBeDefined()
      if (!chatCall || !chatCall[1]) throw new Error('chatCall payload missing')
      const body = JSON.parse(chatCall[1].body)
      expect(body.pageContext.pageKey).toBe('automod')

      const signal = chatCall[1].signal as AbortSignal
      expect(signal.aborted).toBe(false)

      // Confirm no additional history GET occurred (mockFetch was only called twice)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Resolve first request
      await act(async () => chatRequest.resolve(makeResponse({ response: 'Response 1' })))
      await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
      expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Response 1')

      // Send another message on music page
      mockFetch.mockResolvedValueOnce(makeResponse({ response: 'Response 2' }))
      await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Question 2')
      await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))

      await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))

      const secondChatCall = mockFetch.mock.calls[2]
      expect(secondChatCall).toBeDefined()
      if (!secondChatCall || !secondChatCall[1]) throw new Error('secondChatCall payload missing')
      const secondBody = JSON.parse(secondChatCall[1].body)
      expect(secondBody.pageContext.pageKey).toBe('music')
    })

    test('retry captures current page at retry time and avoids message duplication', async () => {
      mockFetch
        .mockResolvedValueOnce(historyResponse()) // initial setup history
        .mockResolvedValueOnce(makeResponse({ error: 'Failed' }, false)) // failed send on setup

      renderProvider('/guild/123/setup')
      await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))

      await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Retry message')
      await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))

      // Wait for error state
      await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toContainHTML('Failed:error'))

      // Navigate to welcome page
      await act(async () => navigateTo('/guild/123/welcome'))

      // Trigger retry
      mockFetch.mockResolvedValueOnce(makeResponse({ response: 'Retry Success' }))
      await userEvent.click(getConsumer('A').getByRole('button', { name: 'Retry A' }))

      await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))
      expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Retry Success')

      // Verify no message duplication
      const text = getConsumer('A').getByTestId('messages').textContent || ''
      const occurrences = (text.match(/Retry message/g) || []).length
      expect(occurrences).toBe(1)

      // Verify captured welcome key in second chat call
      const retryChatCall = mockFetch.mock.calls[2]
      expect(retryChatCall).toBeDefined()
      if (!retryChatCall || !retryChatCall[1]) throw new Error('retryChatCall payload missing')
      const retryBody = JSON.parse(retryChatCall[1].body)
      expect(retryBody.pageContext.pageKey).toBe('welcome')
    })

    test('guild change aborts old request, loads new history, and isolates pages', async () => {
      const chatRequestA = deferred<ReturnType<typeof makeResponse>>()
      mockFetch
        .mockResolvedValueOnce(historyResponse()) // Guild A history
        .mockReturnValueOnce(chatRequestA.promise) // Guild A chat request
        .mockResolvedValueOnce(historyResponse([{ role: 'user', content: 'Guild B message' }])) // Guild B history

      renderProvider('/guild/guild-A/automod')
      await waitFor(() => expect(getConsumer('A').getByTestId('operation')).toHaveTextContent('idle'))

      await userEvent.type(getConsumer('A').getByLabelText('Draft A'), 'Message Guild A')
      await userEvent.click(getConsumer('A').getByRole('button', { name: 'Send A' }))

      const callGuildA = mockFetch.mock.calls[1]
      expect(callGuildA).toBeDefined()
      if (!callGuildA || !callGuildA[1]) throw new Error('callGuildA payload missing')
      const signalA = callGuildA[1].signal as AbortSignal
      expect(signalA.aborted).toBe(false)

      // Navigate to Guild B
      await act(async () => navigateTo('/guild/guild-B/music'))
      expect(signalA.aborted).toBe(true)

      // Wait for Guild B history load
      await waitFor(() => expect(getConsumer('A').getByTestId('messages')).toHaveTextContent('Guild B message'))

      // Resolve old request A and ensure it does not update Guild B
      await act(async () => chatRequestA.resolve(makeResponse({ response: 'Late Guild A response' })))
      expect(getConsumer('A').getByTestId('messages')).not.toHaveTextContent('Late Guild A response')
    })
  })
})
