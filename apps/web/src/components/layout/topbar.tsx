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

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleExtras = () => {
    window.open('/extras', '_blank', 'noopener,noreferrer')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/75 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-5">
        {/* Left: Breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <div key={crumb.label} className="flex items-center gap-1">
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
        </div>

        {/* Right: Actions + User */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={open} 
              className="h-9 gap-1.5 px-2.5 sm:px-3"
            >
              <Search className="h-4 w-4" />
              <span className="hidden lg:inline text-sm">Buscar</span>
              <kbd className="hidden rounded bg-surface/60 px-1 py-0.5 text-[10px] font-mono lg:inline">
                ⌘K
              </kbd>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExtras} 
              className="h-9 gap-1.5 px-2.5 sm:px-3"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden lg:inline text-sm">Extras</span>
            </Button>
          </div>

          {/* Divider */}
          <div className="hidden h-6 w-px bg-border/60 sm:block" />

          {/* User info */}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">{user?.username}</div>
            <div className="text-xs text-muted-foreground">#{user?.discriminator}</div>
          </div>

          {/* Avatar */}
          <div
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/80 bg-surface/60',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.03)]'
            )}
          >
            <img src="/icon.png" alt="Yue" className="h-5 w-5 rounded" />
          </div>

          {/* Logout */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout} 
            className="h-9 w-9 px-0 sm:w-auto sm:px-2.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5 text-sm">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
