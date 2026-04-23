import { useMemo, useRef } from 'react'
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
      'keyword-triggers': { label: 'Gatilhos' },
      music: { label: 'Música' },
    }

    // Build regex pattern to match path segments exactly
    // Matches /segment or /guild/{guildId}/segment
    const pathParts = path.split('/').filter(Boolean)

    for (const [key, value] of Object.entries(segments)) {
      const keyParts = key.split('/')
      // Check if path contains this segment at the correct position
      const segmentIndex = pathParts.findIndex((part, idx) => {
        // For guild routes: guild/{guildId}/{segment}
        // For base routes: {segment}
        if (guildId && idx === 0 && part === 'guild') {
          return keyParts.every((kp, ki) => pathParts[idx + 1 + ki] === kp)
        }
        return keyParts.every((kp, ki) => pathParts[idx + ki] === kp)
      })

      if (segmentIndex !== -1) {
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
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const extrasButtonRef = useRef<HTMLButtonElement>(null)
  const logoutButtonRef = useRef<HTMLButtonElement>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleExtras = () => {
    window.open('/extras', '_blank', 'noopener,noreferrer')
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    action: () => void
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/75 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-5">
        {/* Left: Breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center">
          <nav aria-label="Breadcrumb navigation" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
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
              ref={searchButtonRef}
              variant="outline"
              size="sm"
              onClick={open}
              onKeyDown={(e) => handleKeyDown(e, open)}
              className="h-9 gap-1.5 px-2.5 sm:px-3"
              aria-label="Open command palette"
              aria-keyshortcuts="Ctrl+K"
            >
              <Search className="h-4 w-4" />
              <span className="hidden lg:inline text-sm">Buscar</span>
              <kbd className="hidden rounded bg-surface/60 px-1 py-0.5 text-[10px] font-mono lg:inline">
                {typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win') ? 'Ctrl+K' : '⌘K'}
              </kbd>
            </Button>

            <Button
              ref={extrasButtonRef}
              variant="outline"
              size="sm"
              onClick={handleExtras}
              onKeyDown={(e) => handleKeyDown(e, handleExtras)}
              className="h-9 gap-1.5 px-2.5 sm:px-3"
              aria-label="Open Extras panel in new tab"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden lg:inline text-sm">Extras</span>
            </Button>
          </div>

          {/* Divider */}
          <div className="hidden h-6 w-px bg-border/60 sm:block" />

          {/* User info */}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight" aria-label={`Logged in as ${user?.username}`}>
              {user?.username}
            </div>
            <div className="text-xs text-muted-foreground">#{user?.discriminator}</div>
          </div>

          {/* Avatar */}
          <div
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/80 bg-surface/60',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.03)]'
            )}
            aria-label="User avatar"
          >
            <img src="/icon.png" alt="User avatar" className="h-5 w-5 rounded" />
          </div>

          {/* Logout */}
          <Button
            ref={logoutButtonRef}
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            onKeyDown={(e) => handleKeyDown(e, handleLogout)}
            className="h-9 w-9 px-0 sm:w-auto sm:px-2.5"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5 text-sm">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
