/**
 * Componente AppShell que envolve toda a aplicação
 *
 * @returns {JSX.Element} Estrutura principal da aplicação
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, Outlet, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { ToastViewport } from '../ui'
import { Seo } from '../seo/seo'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from '../command_palette'
import { useKeyboardShortcuts } from '../../hooks/use_keyboard'
import { RouteLoading } from './route_loading'
import { getPanelAssistantGuildId, PanelAssistantProvider } from '../panel-ai/PanelAssistantProvider'
import { PanelAssistantDrawer } from '../panel-ai/PanelAssistantDrawer'

const STORAGE_KEY = 'yuebot-sidebar-collapsed'

export function AppShell() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [ellaDrawerOpen, setEllaDrawerOpen] = useState(false)
  const ellaTriggerRef = useRef<HTMLButtonElement>(null)

  useKeyboardShortcuts()

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === '1') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  const content_key = useMemo(() => location.pathname, [location.pathname])
  const activeGuildId = getPanelAssistantGuildId(location.pathname)
  const isAssistantPage = matchPath({ path: '/guild/:guildId/assistant', end: true }, location.pathname) !== null
  const drawerRouteIsVisible = Boolean(activeGuildId) && !isAssistantPage
  const visibleEllaDrawer = ellaDrawerOpen && drawerRouteIsVisible

  useEffect(() => {
    if (!drawerRouteIsVisible) setEllaDrawerOpen(false)
  }, [drawerRouteIsVisible])

  return (
    <PanelAssistantProvider>
      <div data-theme="yudark" className="h-screen overflow-hidden bg-canvas text-foreground">
        <Seo />

        <div className="relative flex h-full">
          <Sidebar collapsed={collapsed} onToggle={toggle} />

          <div className="min-w-0 flex flex-1 flex-col">
            <div className="scrollbar-yue min-h-0 flex-1 overflow-y-auto">
              <Topbar
                ellaDrawerOpen={visibleEllaDrawer}
                onToggleEllaDrawer={() => setEllaDrawerOpen((open) => !open)}
                ellaTriggerRef={ellaTriggerRef}
              />
              <main id="main-content" className={cn('px-4 py-5 sm:px-5', 'animate-fadeIn')} key={content_key} tabIndex={-1}>
                <Suspense fallback={<RouteLoading />}>
                  <Outlet />
                </Suspense>
              </main>
            </div>
          </div>
        </div>

        <PanelAssistantDrawer
          open={visibleEllaDrawer}
          onClose={() => setEllaDrawerOpen(false)}
          triggerRef={ellaTriggerRef}
        />

        <ToastViewport />
        <CommandPalette />
      </div>
    </PanelAssistantProvider>
  )
}
