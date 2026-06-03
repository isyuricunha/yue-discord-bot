import { useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { Seo } from '../seo/seo'

function nav_link_class({ isActive }: { isActive: boolean }) {
  return cn(
    'inline-flex items-center rounded-md border border-transparent px-3 py-1.5 text-[13px] transition-colors',
    'hover:bg-cursor-bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-accent',
    isActive ? 'border-l-accent bg-cursor-accent-soft text-white' : 'text-muted-foreground'
  )
}

export function PublicShell() {
  const location = useLocation()
  const content_key = useMemo(() => location.pathname, [location.pathname])

  return (
    <div data-theme="yu-dark" className="min-h-screen bg-background text-foreground">
      <Seo />

      <header className="sticky top-0 z-20 border-b border-border/80 bg-background">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-border/80 bg-surface">
              <img src="/icon.png" alt="Yue" className="h-6 w-6 rounded" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Yue</div>
              <div className="text-xs text-muted-foreground">Extras</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink to="/extras" className={nav_link_class} end>
              Extras
            </NavLink>
            <NavLink to="/login" className={nav_link_class} end>
              Login
            </NavLink>
          </nav>
        </div>
      </header>

      <main className={cn('px-5 py-6', 'animate-fadeIn')} key={content_key}>
        <Outlet />
      </main>

      <footer className="border-t border-border/80 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} Yue</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <NavLink to="/termos" className="underline underline-offset-4 hover:text-foreground">
              Termos
            </NavLink>
            <NavLink to="/privacidade" className="underline underline-offset-4 hover:text-foreground">
              Privacidade
            </NavLink>
          </div>
        </div>
      </footer>
    </div>
  )
}
