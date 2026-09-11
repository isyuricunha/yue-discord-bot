import * as React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../lib/cn'

const links = [
  { to: '/docs', label: 'Visão geral', end: true },
  { to: '/docs/comandos', label: 'Comandos' },
  { to: '/docs/guias', label: 'Guias' },
]

function DocsLayout() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Documentação da Yue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo sobre a Yue: comandos com exemplos, guias de cada sistema e como usar o painel.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-52 lg:shrink-0">
          <nav
            className="flex gap-2 overflow-x-auto rounded-2xl border border-border/70 bg-surface p-2 lg:sticky lg:top-16 lg:flex-col lg:overflow-visible"
            aria-label="Seções da documentação"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-accent/10 font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-surface/60 hover:text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <React.Suspense fallback={null}>
            <Outlet />
          </React.Suspense>
        </div>
      </div>
    </div>
  )
}

export default DocsLayout
