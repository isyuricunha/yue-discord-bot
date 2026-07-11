
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import PanelAssistantPage from '../../pages/PanelAssistant'
import { AppShell } from './app_shell'

vi.mock('../../env', () => ({ getApiUrl: () => 'http://localhost:3000' }))
vi.mock('../../store/toast', () => ({
  toast_success: vi.fn(),
  toast_error: vi.fn(),
  useToastStore: () => ({ toasts: [], dismiss: vi.fn() }),
}))
vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({
    user: { username: 'Shell tester', discriminator: '0001' },
    logout: vi.fn(),
  }),
}))
vi.mock('../../hooks/use_keyboard', () => ({ useKeyboardShortcuts: vi.fn() }))
vi.mock('../seo/seo', () => ({ Seo: () => null }))
vi.mock('./sidebar', () => ({ Sidebar: () => <nav aria-label="Sidebar" /> }))
vi.mock('../command_palette', () => ({ CommandPalette: () => null }))

const mockFetch = vi.fn()
window.fetch = mockFetch as unknown as typeof window.fetch

function response(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) }
}

function history(messages: unknown[] = []) {
  return response({ success: true, messages })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolver) => { resolve = resolver })
  return { promise, resolve }
}

let navigateTo: ReturnType<typeof useNavigate>

function NavigationController() {
  navigateTo = useNavigate()
  return null
}

function renderShell(path = '/guild/123/automod') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavigationController />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/guild/:guildId/assistant" element={<PanelAssistantPage />} />
          <Route path="/guild/:guildId/:section" element={<div>Guild page</div>} />
          <Route path="/badges" element={<div>Badges page</div>} />
          <Route path="/" element={<div>Home page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

function mockMatchMedia(mobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width') ? mobile : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('AppShell Ella integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockMatchMedia(false)
    Element.prototype.scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollTo = vi.fn()
    document.body.style.overflow = ''
    localStorage.clear()
  })

  test('keeps one shared drawer across sibling routes and removes it on the full-page route', async () => {
    mockFetch.mockResolvedValueOnce(history([{ role: 'assistant', content: 'Shared history' }]))
    const user = userEvent.setup()
    renderShell()

    const trigger = screen.getByRole('button', { name: 'Abrir Ella' })
    await user.click(trigger)
    expect(screen.getAllByRole('complementary', { name: 'Assistente Ella' })).toHaveLength(1)
    await screen.findByText('Shared history')
    await user.type(screen.getByLabelText('Campo de mensagem'), 'Shared draft')

    await act(async () => navigateTo('/guild/123/music'))
    expect(screen.getByRole('complementary', { name: 'Assistente Ella' })).toBeInTheDocument()
    expect(screen.getByLabelText('Campo de mensagem')).toHaveValue('Shared draft')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await act(async () => navigateTo('/guild/123/assistant'))
    expect(screen.queryByRole('complementary', { name: 'Assistente Ella' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Abrir Ella|Fechar Ella/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('ella-drawer-portal')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Campo de mensagem')).toHaveValue('Shared draft')
    expect(screen.getByText('Shared history')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('removes the mobile drawer immediately on a non-guild route and restores body scrolling', async () => {
    mockMatchMedia(true)
    mockFetch.mockResolvedValueOnce(history())
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    expect(screen.getByTestId('ella-drawer-portal')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => navigateTo('/badges'))
    expect(screen.queryByTestId('ella-drawer-portal')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Abrir Ella|Fechar Ella/ })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('keeps the drawer open while switching guilds and exposes only the new guild state', async () => {
    const guildB = deferred<ReturnType<typeof history>>()
    mockFetch
      .mockResolvedValueOnce(history([{ role: 'assistant', content: 'Guild 123 history' }]))
      .mockReturnValueOnce(guildB.promise)
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Guild 123 history')
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    expect(screen.getByLabelText('Encerrar conversa')).toBeInTheDocument()

    await act(async () => navigateTo('/guild/456/music'))
    expect(screen.getByRole('complementary', { name: 'Assistente Ella' })).toBeInTheDocument()
    expect(screen.queryByText('Guild 123 history')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Encerrar conversa')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Carregando histórico')).toBeInTheDocument()

    await act(async () => guildB.resolve(history([{ role: 'assistant', content: 'Guild 456 history' }])))
    await waitFor(() => expect(screen.getByText('Guild 456 history')).toBeInTheDocument())
    expect(screen.queryByText('Guild 123 history')).not.toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })
})
