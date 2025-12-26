import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { ToastViewport } from '../ui'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

const STORAGE_KEY = 'yuebot-sidebar-collapsed'

export function AppShell() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/8 blur-[120px]" />
        <div className="absolute -bottom-52 right-[-120px] h-[520px] w-[520px] rounded-full bg-accent/4 blur-[120px]" />
      </div>

      <div className="relative flex">
        <Sidebar collapsed={collapsed} onToggle={toggle} />

        <div className="min-w-0 flex-1">
          <Topbar />
          <main className={cn('px-5 py-6', 'animate-fadeIn')} key={content_key}>
            <Outlet />
          </main>
        </div>
      </div>

      <ToastViewport />
    </div>
  )
}
