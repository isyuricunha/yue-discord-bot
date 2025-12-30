import { useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'

function nav_link_class({ isActive }: { isActive: boolean }) {
  return cn(
    'inline-flex items-center rounded-xl px-3 py-2 text-sm transition-colors',
    'hover:bg-surface/70 hover:text-foreground',
    isActive ? 'bg-surface/80 text-foreground border border-border/80' : 'text-muted-foreground'
  )
}

export function PublicShell() {
  const location = useLocation()
  const content_key = useMemo(() => location.pathname, [location.pathname])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute -bottom-52 right-[-120px] h-[520px] w-[520px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/75 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
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

      <footer className="border-t border-border/80 bg-background/60 backdrop-blur-md">
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
