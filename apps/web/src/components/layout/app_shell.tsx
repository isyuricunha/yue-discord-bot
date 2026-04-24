/**
 * Componente AppShell que envolve toda a aplicação
 *
 * @returns {JSX.Element} Estrutura principal da aplicação
 */
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { ToastViewport } from '../ui'
import { Seo } from '../seo/seo'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { CommandPalette } from '../command_palette'
import { useKeyboardShortcuts } from '../../hooks/use_keyboard'

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
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <Seo />
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/8 blur-[120px]" />
        <div className="absolute -bottom-52 right-[-120px] h-[520px] w-[520px] rounded-full bg-accent/4 blur-[120px]" />
      </div>


      <div className="relative flex h-full">
        <Sidebar collapsed={collapsed} onToggle={toggle} />

        <div className="min-w-0 flex flex-1 flex-col">
          <div className="scrollbar-yue min-h-0 flex-1 overflow-y-auto">
            <Topbar />
            <main id="main-content" className={cn('px-5 py-6', 'animate-fadeIn')} key={content_key} tabIndex={-1}>
              <Outlet />
            </main>
          </div>
        </div>
      </div>

      <ToastViewport />
      <CommandPalette />
    </div>
  )
}
