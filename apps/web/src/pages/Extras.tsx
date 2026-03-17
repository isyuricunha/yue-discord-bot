import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { cn } from '../lib/cn'
import { Card, CardContent, CardHeader } from '../components/ui'

type nav_item = {
  to: string
  label: string
  description: string
  icon?: string
}

const items: nav_item[] = [
  {
    to: '/extras',
    label: 'Início',
    description: 'Visão geral do conteúdo disponível.',
    icon: '🏠',
  },
  {
    to: '/extras/sobre',
    label: 'Sobre a Yue',
    description: 'FAQ e como começar.',
    icon: '❓',
  },
  {
    to: '/extras/moderacao',
    label: 'Moderação',
    description: 'Guia de comandos e do módulo.',
    icon: '🛡️',
  },
  {
    to: '/extras/comandos',
    label: 'Comandos',
    description: 'Lista completa de comandos e exemplos.',
    icon: '⚡',
  },
  {
    to: '/extras/placeholders',
    label: 'Placeholders',
    description: 'Variáveis suportadas em mensagens.',
    icon: '📝',
  },
  {
    to: '/extras/apelo-de-ban',
    label: 'Apelo de ban',
    description: 'Regras e como proceder.',
    icon: '📜',
  },
]

function nav_link_class({ isActive }: { isActive: boolean }) {
  return cn(
    'block rounded-xl border border-border/70 px-4 py-3 transition-colors',
    'hover:border-accent/50 hover:bg-surface/50',
    isActive ? 'bg-surface/60 text-foreground' : 'bg-surface/30 text-muted-foreground'
  )
}

function Breadcrumb() {
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)

  // Build breadcrumb items
  const breadcrumbs = [{ label: 'Extras', path: '/extras' }]

  if (pathSegments.length > 1) {
    const currentPage = items.find(item => item.to === location.pathname)
    if (currentPage) {
      breadcrumbs.push({ label: currentPage.label, path: currentPage.to })
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.path} className="flex items-center gap-2">
          {index > 0 && <span className="text-muted-foreground">/</span>}
          {index < breadcrumbs.length - 1 ? (
            <NavLink
              to={crumb.path}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {crumb.label}
            </NavLink>
          ) : (
            <span className="text-foreground font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export default function ExtrasPage() {
  const location = useLocation()
  const isHome = location.pathname === '/extras'

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <Breadcrumb />
        <div className="mt-2 text-2xl font-semibold tracking-tight">{isHome ? 'Extras' : ''}</div>
        <div className="mt-1 text-sm text-muted-foreground">Guias, FAQs e informações úteis sobre a Yue.</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <div className="text-base font-semibold">Navegação</div>
            <div className="mt-1 text-sm text-muted-foreground">Escolha um tópico para ler.</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className={nav_link_class} end={item.to === '/extras'}>
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </div>
              </NavLink>
            ))}
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
