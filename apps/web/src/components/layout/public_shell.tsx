import { Suspense, useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { Seo } from '../seo/seo'
import { RouteLoading } from './route_loading'

function nav_link_class({ isActive }: { isActive: boolean }) {
  return cn(
    'inline-flex h-8 items-center rounded-xl border px-3 text-sm transition-colors',
    'hover:border-accent/35 hover:bg-accent/10 hover:text-foreground',
    isActive ? 'border-accent/35 bg-accent/10 text-foreground' : 'border-transparent text-muted-foreground'
  )
}

export function PublicShell() {
  const location = useLocation()
  const content_key = useMemo(() => location.pathname, [location.pathname])

  return (
    <div data-theme="yu-dark" className="min-h-screen bg-canvas text-foreground">
      <Seo />

      <header className="sticky top-0 z-20 border-b border-border/80 bg-window">
        <div className="flex h-12 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-2xl border border-border/80 bg-surface-raised shadow-innerBorder">
              <img src="/icon.png" alt="Yue" className="h-5 w-5 rounded" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Yue</div>
              <div className="font-mono text-[11px] text-muted-foreground">Extras</div>
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
        <Suspense fallback={<RouteLoading />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-border/80 bg-window">
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
