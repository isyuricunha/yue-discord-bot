import { useMemo } from 'react'
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'
import { LogOut, ExternalLink, ChevronRight, Home, LayoutDashboard, Search } from 'lucide-react'

import { useAuthStore } from '../../store/auth'
import { useCommandPaletteStore } from '../../store/command_palette'
import { cn } from '../../lib/cn'
import { Button } from '../ui'

type breadcrumb_item = {
  label: string
  to?: string
  icon?: React.ReactNode
}

function useBreadcrumbs(guildId: string | undefined, location: { pathname: string }) {
  return useMemo(() => {
    const path = location.pathname
    const crumbs: breadcrumb_item[] = [{ label: 'Painel', to: '/', icon: <Home className="h-3.5 w-3.5" /> }]

    if (guildId) {
      crumbs.push({
        label: 'Servidor',
        to: `/guild/${guildId}`,
        icon: <LayoutDashboard className="h-3.5 w-3.5" />,
      })
    }

    const segments: Record<string, { label: string; parent?: string }> = {
      overview: { label: 'Visão geral' },
      automod: { label: 'AutoMod' },
      modlogs: { label: 'Logs' },
      moderation: { label: 'Moderação' },
      members: { label: 'Membros' },
      giveaways: { label: 'Sorteios' },
      settings: { label: 'Configurações' },
      welcome: { label: 'Boas-vindas' },
      xp: { label: 'XP' },
      autorole: { label: 'Autorole' },
      tickets: { label: 'Tickets' },
      suggestions: { label: 'Sugestões' },
      'reaction-roles': { label: 'Reaction Roles' },
      starboard: { label: 'Starboard' },
      audit: { label: 'Audit' },
      commands: { label: 'Comandos' },
      setup: { label: 'Setup' },
      'custom-commands': { label: 'Custom Commands' },
      music: { label: 'Música' },
    }

    for (const [key, value] of Object.entries(segments)) {
      if (path.includes(`/${key}`)) {
        const basePath = guildId ? `/guild/${guildId}/${key}` : `/${key}`
        crumbs.push({ label: value.label, to: basePath })
      }
    }

    return crumbs
  }, [guildId, location.pathname])
}

export function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { guildId } = useParams()
  const { user, logout } = useAuthStore()
  const { open } = useCommandPaletteStore()
  const breadcrumbs = useBreadcrumbs(guildId, location)

  const title = useMemo(() => {
    const lastCrumb = breadcrumbs[breadcrumbs.length - 1]
    return lastCrumb?.label ?? 'Painel'
  }, [breadcrumbs])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleExtras = () => {
    window.open('/extras', '_blank', 'noopener,noreferrer')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/75 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <div key={crumb.label} className="flex items-center gap-1.5">
                  {idx > 0 && <ChevronRight className="h-3 w-3" />}
                  {crumb.to && !isLast ? (
                    <Link
                      to={crumb.to}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {crumb.icon}
                      <span className="hidden sm:inline">{crumb.label}</span>
                    </Link>
                  ) : (
                    <span className={cn('flex items-center gap-1', isLast && 'font-medium text-foreground')}>
                      {crumb.icon}
                      {crumb.label}
                    </span>
                  )}
                </div>
              )
            })}
          </nav>
          <div className="mt-1 text-sm font-semibold tracking-tight text-foreground">{title}</div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={open} className="h-10">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded bg-surface/60 px-1.5 py-0.5 text-xs font-mono sm:inline">
              ⌘K
            </kbd>
          </Button>

          <Button variant="outline" size="sm" onClick={handleExtras} className="h-10">
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Extras</span>
          </Button>

          <div className="hidden text-right sm:block">
            <div className="text-sm text-foreground">{user?.username}</div>
            <div className="text-xs text-muted-foreground">#{user?.discriminator}</div>
          </div>

          <div
            className={cn(
              'grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.03)]'
            )}
          >
            <img src="/icon.png" alt="Yue" className="h-6 w-6 rounded" />
          </div>

          <Button variant="ghost" size="sm" onClick={handleLogout} className="h-10">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
