import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'

import { Topbar } from './topbar'

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({
    user: { username: 'Ella tester', discriminator: '0001' },
    logout: vi.fn(),
  }),
}))
vi.mock('../../store/command_palette', () => ({ useCommandPaletteStore: () => ({ open: vi.fn() }) }))

function renderTopbar(path: string, open = false, overrides: Partial<React.ComponentProps<typeof Topbar>> = {}) {
  const triggerRef = React.createRef<HTMLButtonElement>()
  const mobileNavTriggerRef = React.createRef<HTMLButtonElement>()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Topbar
        ellaDrawerOpen={open}
        onToggleEllaDrawer={vi.fn()}
        ellaTriggerRef={triggerRef}
        onOpenMobileNav={vi.fn()}
        mobileNavOpen={false}
        mobileNavTriggerRef={mobileNavTriggerRef}
        {...overrides}
      />
    </MemoryRouter>
  )
}

describe('Topbar Ella trigger', () => {
  test('shows the accessible trigger on a regular guild route', () => {
    renderTopbar('/guild/123/automod')
    const trigger = screen.getByRole('button', { name: 'Abrir Ella' })
    expect(trigger).toHaveAttribute('aria-controls', 'ella-drawer')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  test.each(['/owner', '/owner/panel-ai', '/badges', '/extras', '/'])('hides the trigger outside guild routes: %s', (path) => {
    renderTopbar(path)
    expect(screen.queryByRole('button', { name: /Ella/ })).not.toBeInTheDocument()
  })

  test('hides the trigger on the full-page assistant route', () => {
    renderTopbar('/guild/123/assistant')
    expect(screen.queryByRole('button', { name: /Ella/ })).not.toBeInTheDocument()
  })

  test('reflects the open state in its accessible name', () => {
    renderTopbar('/guild/123/music', true)
    expect(screen.getByRole('button', { name: 'Fechar Ella' })).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Topbar mobile navigation trigger', () => {
  test('exposes an accessible trigger wired to the sidebar drawer', () => {
    renderTopbar('/')
    const trigger = screen.getByRole('button', { name: 'Abrir menu de navegação' })
    expect(trigger).toHaveAttribute('aria-controls', 'sidebar')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  test('reflects the drawer open state', () => {
    renderTopbar('/', false, { mobileNavOpen: true })
    expect(screen.getByRole('button', { name: 'Abrir menu de navegação' })).toHaveAttribute('aria-expanded', 'true')
  })

  test('calls the open handler when activated', async () => {
    const onOpenMobileNav = vi.fn()
    renderTopbar('/', false, { onOpenMobileNav })
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu de navegação' }))
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1)
  })
})
