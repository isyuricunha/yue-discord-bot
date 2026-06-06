/**
 * Componente AppShell que envolve toda a aplicação
 *
 * @returns {JSX.Element} Estrutura principal da aplicação
 */
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { ToastViewport } from '../ui'
import { Seo } from '../seo/seo'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from '../command_palette'
import { useKeyboardShortcuts } from '../../hooks/use_keyboard'
import { RouteLoading } from './route_loading'

const STORAGE_KEY = 'yuebot-sidebar-collapsed'

export function AppShell() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

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

  return (
    <div data-theme="yu-dark" className="h-screen overflow-hidden bg-canvas text-foreground">
      <Seo />

      <div className="relative flex h-full">
        <Sidebar collapsed={collapsed} onToggle={toggle} />

        <div className="min-w-0 flex flex-1 flex-col">
          <div className="scrollbar-yue min-h-0 flex-1 overflow-y-auto">
            <Topbar />
            <main id="main-content" className={cn('px-4 py-5 sm:px-5', 'animate-fadeIn')} key={content_key} tabIndex={-1}>
              <Suspense fallback={<RouteLoading />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>
      </div>

      <ToastViewport />
      <CommandPalette />
    </div>
  )
}
