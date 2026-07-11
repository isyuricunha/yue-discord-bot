import * as React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import PanelAssistantPage from '../../pages/PanelAssistant'
import { CommandPalette } from '../command_palette'
import { useCommandPaletteStore } from '../../store/command_palette'
import { getTabbableElements } from '../../lib/tabbable'
import { PanelAssistantDrawer } from './PanelAssistantDrawer'
import { PanelAssistantProvider } from './PanelAssistantProvider'

vi.mock('../../env', () => ({ getApiUrl: () => 'http://localhost:3000' }))
vi.mock('../../store/toast', () => ({ toast_success: vi.fn(), toast_error: vi.fn() }))

const mockFetch = vi.fn()
window.fetch = mockFetch as unknown as typeof window.fetch

function response(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) }
}

function history(messages: unknown[] = []) {
  return response({ success: true, messages })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolver) => { resolve = resolver })
  return { promise, resolve }
}

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function AssistantRoutePage() {
  const location = useLocation()
  return location.pathname.endsWith('/assistant') ? <PanelAssistantPage /> : null
}

let navigateTo: ReturnType<typeof useNavigate>

function NavigationController() {
  navigateTo = useNavigate()
  return null
}

function DrawerHarness({ page = false, palette = false, path = '/guild/123/automod' }: { page?: boolean; palette?: boolean; path?: string }) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  return (
    <MemoryRouter initialEntries={[path]}>
      <PanelAssistantProvider>
        <NavigationController />
        <button
          ref={triggerRef}
          type="button"
          aria-label={open ? 'Fechar Ella' : 'Abrir Ella'}
          aria-controls="ella-drawer"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          Ella
        </button>
        <PanelAssistantDrawer open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} />
        {palette && <CommandPalette />}
        {page && <AssistantRoutePage />}
        <Location />
      </PanelAssistantProvider>
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

describe('PanelAssistantDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCommandPaletteStore.setState({ isOpen: false })
    mockFetch.mockReset()
    mockMatchMedia(false)
    Element.prototype.scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollTo = vi.fn()
  })

  test('opens as a non-modal desktop complementary surface and restores trigger focus', async () => {
    mockFetch.mockResolvedValueOnce(history())
    const user = userEvent.setup()
    render(<DrawerHarness />)

    const trigger = screen.getByRole('button', { name: 'Abrir Ella' })
    await user.click(trigger)
    const drawer = screen.getByRole('complementary', { name: 'Assistente Ella' })
    expect(drawer).toHaveAttribute('id', 'ella-drawer')
    expect(drawer).not.toHaveAttribute('aria-modal')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(within(drawer).getByRole('button', { name: 'Fechar Ella' }))
    expect(screen.queryByRole('complementary', { name: 'Assistente Ella' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  test('does not steal focus when the drawer mounts closed', async () => {
    mockFetch.mockResolvedValueOnce(history())
    render(<><input aria-label="Existing focus" autoFocus /><DrawerHarness /></>)
    await act(async () => Promise.resolve())
    expect(screen.getByLabelText('Existing focus')).toHaveFocus()
  })

  test('uses a modal mobile sheet, locks body scrolling, traps focus, and closes with Escape', async () => {
    mockMatchMedia(true)
    mockFetch.mockResolvedValueOnce(history())
    const user = userEvent.setup()
    render(<DrawerHarness />)

    const trigger = screen.getByRole('button', { name: 'Abrir Ella' })
    await user.click(trigger)
    const drawer = screen.getByRole('dialog', { name: 'Assistente Ella' })
    expect(drawer).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByTestId('ella-drawer-portal')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Assistente Ella' })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(trigger).toHaveFocus()
  })

  test('moves focus into a mobile dialog during history loading and traps focus from outside', async () => {
    mockMatchMedia(true)
    let resolveHistory!: (value: ReturnType<typeof history>) => void
    const pendingHistory = new Promise<ReturnType<typeof history>>((resolve) => { resolveHistory = resolve })
    mockFetch.mockReturnValueOnce(pendingHistory)
    const user = userEvent.setup()
    render(<DrawerHarness />)

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    const dialog = screen.getByRole('dialog', { name: 'Assistente Ella' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    expect(within(dialog).getByRole('button', { name: 'Fechar Ella' })).toHaveFocus()

    screen.getAllByRole('button', { name: 'Fechar Ella' })[0].focus()
    await user.keyboard('{Tab}')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await act(async () => resolveHistory(history()))
  })

  test('cycles mobile focus forward and backward without making the backdrop tabbable', async () => {
    mockMatchMedia(true)
    mockFetch.mockResolvedValueOnce(history([{ role: 'user', content: 'Message' }]))
    const user = userEvent.setup()
    render(<DrawerHarness />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    const dialog = screen.getByRole('dialog', { name: 'Assistente Ella' })
    const controls = dialog.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)')
    const first = controls[0]
    const last = controls[controls.length - 1]

    last.focus()
    await user.keyboard('{Tab}')
    expect(first).toHaveFocus()
    first.focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(last).toHaveFocus()
    expect(within(dialog).getAllByRole('button', { name: 'Fechar Ella' })).toHaveLength(1)
  })

  test('shares the drawer draft with the full page after expanding without another history request', async () => {
    mockFetch.mockResolvedValueOnce(history())
    const user = userEvent.setup()
    render(<DrawerHarness page />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await user.type(screen.getByLabelText('Campo de mensagem'), 'Draft from drawer')
    await user.click(screen.getByRole('button', { name: 'Abrir Ella em página completa' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/guild/123/assistant')
    expect(screen.queryByRole('complementary', { name: 'Assistente Ella' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Campo de mensagem')).toHaveValue('Draft from drawer')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('sends through the shared controller and keeps the completed turn after expanding', async () => {
    mockFetch
      .mockResolvedValueOnce(history())
      .mockResolvedValueOnce(response({ response: 'Shared answer' }))
    const user = userEvent.setup()
    render(<DrawerHarness page />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await user.type(screen.getByLabelText('Campo de mensagem'), 'Shared question')
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    expect(await screen.findByText('Shared answer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Abrir Ella em página completa' }))
    expect(screen.getAllByText('Shared question')).toHaveLength(1)
    expect(screen.getAllByText('Shared answer')).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('confirms clearing before the shared conversation is deleted', async () => {
    mockFetch
      .mockResolvedValueOnce(history([{ role: 'user', content: 'Keep until confirmed' }]))
      .mockResolvedValueOnce(response({ success: true }))
    const user = userEvent.setup()
    render(<DrawerHarness />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    expect(await screen.findByText('Keep until confirmed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    const confirmation = screen.getByLabelText('Encerrar conversa')
    expect(confirmation).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Encerrar' }))
    await waitFor(() => expect(screen.queryByText('Keep until confirmed')).not.toBeInTheDocument())
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('resets a local clear confirmation before the next guild can paint it', async () => {
    mockFetch
      .mockResolvedValueOnce(history([{ role: 'user', content: 'Guild 123 message' }]))
      .mockResolvedValueOnce(history([{ role: 'assistant', content: 'Guild 456 message' }]))
    const user = userEvent.setup()
    render(<DrawerHarness />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Guild 123 message')
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    expect(screen.getByLabelText('Encerrar conversa')).toBeInTheDocument()

    await act(async () => navigateTo('/guild/456/music'))
    expect(screen.queryByLabelText('Encerrar conversa')).not.toBeInTheDocument()
    expect(await screen.findByText('Guild 456 message')).toBeInTheDocument()
  })

  test('lets the command palette consume the first Escape before closing Ella', async () => {
    mockFetch.mockResolvedValueOnce(history())
    const user = userEvent.setup()
    render(<DrawerHarness palette />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    act(() => useCommandPaletteStore.getState().open())
    expect(screen.getByRole('dialog', { name: 'Command Palette' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Command Palette' })).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Assistente Ella' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('complementary', { name: 'Assistente Ella' })).not.toBeInTheDocument()
  })

  test('suspends mobile Ella focus handling while the command palette is open', async () => {
    mockMatchMedia(true)
    mockFetch.mockResolvedValueOnce(history())
    const user = userEvent.setup()
    render(<DrawerHarness palette />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    act(() => useCommandPaletteStore.getState().open())

    const palette = screen.getByRole('dialog', { name: 'Command Palette' })
    const input = within(palette).getByRole('textbox', { name: 'Buscar' })
    expect(input).toHaveFocus()
    const ella = screen.getByTestId('ella-drawer-portal').querySelector('[role="dialog"]')
    expect(ella).toHaveAttribute('aria-hidden', 'true')
    expect(ella).toHaveAttribute('inert')

    const paletteControls = getTabbableElements(palette)
    const firstPaletteControl = paletteControls[0]
    const lastPaletteControl = paletteControls[paletteControls.length - 1]
    lastPaletteControl.focus()
    await user.keyboard('{Tab}')
    expect(firstPaletteControl).toHaveFocus()
    firstPaletteControl.focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(lastPaletteControl).toHaveFocus()

    screen.getAllByRole('button', { name: 'Fechar Ella' })[0].focus()
    await user.keyboard('{Tab}')
    expect(firstPaletteControl).toHaveFocus()
    screen.getAllByRole('button', { name: 'Fechar Ella' })[0].focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(lastPaletteControl).toHaveFocus()
    expect(ella).not.toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    const restoredElla = screen.getByRole('dialog', { name: 'Assistente Ella' })
    expect(restoredElla).toContainElement(document.activeElement as HTMLElement)
  })

  test('restores focus to the active clear confirmation after the palette closes', async () => {
    mockMatchMedia(true)
    mockFetch.mockResolvedValueOnce(history([{ role: 'assistant', content: 'Existing message' }]))
    const user = userEvent.setup()
    render(<DrawerHarness palette />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Existing message')
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
    })
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    act(() => useCommandPaletteStore.getState().open())
    expect(within(screen.getByRole('dialog', { name: 'Command Palette' })).getByRole('textbox', { name: 'Buscar' })).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.getByLabelText('Encerrar conversa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Assistente Ella' })).toBeInTheDocument()
  })

  test('does not focus the composer when a response completes behind the command palette', async () => {
    mockMatchMedia(true)
    const chat = deferred<ReturnType<typeof response>>()
    mockFetch.mockResolvedValueOnce(history()).mockReturnValueOnce(chat.promise)
    const user = userEvent.setup()
    render(<DrawerHarness palette />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await user.type(screen.getByLabelText('Campo de mensagem'), 'Question')
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    act(() => useCommandPaletteStore.getState().open())
    const paletteInput = within(screen.getByRole('dialog', { name: 'Command Palette' })).getByRole('textbox', { name: 'Buscar' })

    await act(async () => chat.resolve(response({ response: 'Answer' })))
    expect(paletteInput).toHaveFocus()
  })

  test('includes safe Markdown links in the mobile focus order', async () => {
    mockMatchMedia(true)
    mockFetch.mockResolvedValueOnce(history([{ role: 'assistant', content: '[Configurações](/settings)' }]))
    const user = userEvent.setup()
    render(<DrawerHarness />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    const dialog = screen.getByRole('dialog', { name: 'Assistente Ella' })
    const link = await within(dialog).findByRole('link', { name: 'Configurações' })
    const controls = getTabbableElements(dialog)

    expect(controls).toContain(link)
    expect(controls.some((control) => control.matches(':disabled'))).toBe(false)
    link.focus()
    await user.keyboard('{Tab}')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(link).toHaveFocus()
  })

  test('scrolls once after deferred history hydration when Ella was opened while loading', async () => {
    const request = deferred<ReturnType<typeof history>>()
    mockFetch.mockReturnValueOnce(request.promise)
    const user = userEvent.setup()
    render(<DrawerHarness />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()

    await act(async () => request.resolve(history([{ role: 'assistant', content: 'Hydrated' }])))
    await screen.findByText('Hydrated')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  test('resets local scroll and scrolls after guild B hydrates without reloading sibling routes', async () => {
    const guildB = deferred<ReturnType<typeof history>>()
    mockFetch
      .mockResolvedValueOnce(history([{ role: 'assistant', content: 'Guild A' }]))
      .mockReturnValueOnce(guildB.promise)
    const user = userEvent.setup()
    render(<DrawerHarness />)
    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Guild A')
    const conversation = screen.getByTestId('ella-drawer-conversation')

    await act(async () => navigateTo('/guild/123/music'))
    expect(HTMLElement.prototype.scrollTo).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await act(async () => navigateTo('/guild/456/music'))
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({ top: 0 })
    const scrollCallsBeforeHydration = vi.mocked(Element.prototype.scrollIntoView).mock.calls.length
    await act(async () => guildB.resolve(history([{ role: 'assistant', content: 'Guild B' }])))
    await screen.findByText('Guild B')
    expect(conversation).toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(scrollCallsBeforeHydration + 1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('restores focus to the clear trigger after explicit cancel on mobile without composer stealing focus', async () => {
    mockMatchMedia(true)
    mockFetch.mockResolvedValueOnce(history([{ role: 'assistant', content: 'Message' }]))
    const user = userEvent.setup()
    render(<DrawerHarness />)

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Message')

    const trigger = screen.getByRole('button', { name: 'Nova conversa' })
    await user.click(trigger)

    const cancel = screen.getByRole('button', { name: 'Cancelar' })
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
    })
    expect(cancel).toHaveFocus()

    await user.click(cancel)
    expect(screen.queryByLabelText('Encerrar conversa')).not.toBeInTheDocument()

    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
    })

    expect(trigger).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Campo de mensagem' })).not.toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Assistente Ella' })).toBeInTheDocument()
  })

  test('restores focus to the clear trigger after Escape cancel on mobile without composer stealing focus', async () => {
    mockMatchMedia(true)
    mockFetch.mockResolvedValueOnce(history([{ role: 'assistant', content: 'Message' }]))
    const user = userEvent.setup()
    render(<DrawerHarness />)

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Message')

    const trigger = screen.getByRole('button', { name: 'Nova conversa' })
    await user.click(trigger)

    const cancel = screen.getByRole('button', { name: 'Cancelar' })
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
    })
    expect(cancel).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('Encerrar conversa')).not.toBeInTheDocument()

    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
    })

    expect(trigger).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Campo de mensagem' })).not.toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Assistente Ella' })).toBeInTheDocument()
  })

  test('restores focus to the clear trigger after cancel on desktop without composer stealing focus', async () => {
    mockFetch.mockResolvedValueOnce(history([{ role: 'assistant', content: 'Message' }]))
    const user = userEvent.setup()
    render(<DrawerHarness />)

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Message')

    const trigger = screen.getByRole('button', { name: 'Nova conversa' })
    await user.click(trigger)

    const cancel = screen.getByRole('button', { name: 'Cancelar' })

    await user.click(cancel)
    expect(screen.queryByLabelText('Encerrar conversa')).not.toBeInTheDocument()

    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
    })

    expect(trigger).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Campo de mensagem' })).not.toHaveFocus()
  })

  test('uses correct inline non-modal accessibility semantics for the clear confirmation', async () => {
    mockFetch.mockResolvedValueOnce(history([{ role: 'assistant', content: 'Message' }]))
    const user = userEvent.setup()
    render(<DrawerHarness />)

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Message')

    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))

    const group = screen.getByRole('group', { name: 'Encerrar conversa' })
    expect(group).toBeInTheDocument()
    expect(group).toHaveAccessibleDescription('Tem certeza que deseja encerrar esta conversa?')
    expect(group).not.toHaveAttribute('role', 'dialog')
    expect(group).not.toHaveAttribute('role', 'alertdialog')

    expect(within(group).getByRole('button', { name: 'Encerrar' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  test('does not restore focus to the trigger after a successful clear, allowing normal composer focus', async () => {
    mockFetch
      .mockResolvedValueOnce(history([{ role: 'user', content: 'Message' }]))
      .mockResolvedValueOnce(response({ success: true }))
    const user = userEvent.setup()
    render(<DrawerHarness />)

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Message')

    const trigger = screen.getByRole('button', { name: 'Nova conversa' })
    await user.click(trigger)

    await user.click(screen.getByRole('button', { name: 'Encerrar' }))

    await waitFor(() => expect(screen.queryByText('Message')).not.toBeInTheDocument())

    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
    })

    expect(trigger).not.toHaveFocus()
    expect(trigger).toBeDisabled()

    expect(screen.getByRole('textbox', { name: 'Campo de mensagem' })).toHaveFocus()
  })

  test('safely discards pending clear-trigger focus intent if drawer closes or guild changes', async () => {
    mockFetch.mockResolvedValueOnce(history([{ role: 'user', content: 'Message' }]))
    const user = userEvent.setup()
    const { unmount } = render(<DrawerHarness />)

    await user.click(screen.getByRole('button', { name: 'Abrir Ella' }))
    await screen.findByText('Message')

    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))

    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
    })
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    // Navigate while confirmation is open to trigger guild change cleanup
    await act(async () => navigateTo('/guild/456/music'))

    expect(screen.queryByRole('button', { name: 'Nova conversa' })).not.toHaveFocus()
    unmount()
  })

  test('does not render a drawer until it is opened', async () => {
    mockFetch.mockResolvedValueOnce(history())
    render(<DrawerHarness />)
    await act(async () => Promise.resolve())
    expect(screen.queryByTestId('ella-drawer-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ella-drawer-portal')).not.toBeInTheDocument()
  })
})
