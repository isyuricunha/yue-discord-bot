import { useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { useAuthStore } from '../../store/auth'
import { cn } from '../../lib/cn'
import { Button } from '../ui'

function truncate_middle(value: string, start = 6, end = 4) {
  if (value.length <= start + end + 3) return value
  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { guildId } = useParams()
  const { user, logout } = useAuthStore()

  const title = useMemo(() => {
    const path = location.pathname

    if (path === '/') return 'Dashboard'
    if (guildId && path === `/guild/${guildId}`) return 'Guild'

    if (path.includes('/overview')) return 'Visão geral'
    if (path.includes('/automod')) return 'AutoMod'
    if (path.includes('/modlogs')) return 'Logs'
    if (path.includes('/moderation')) return 'Moderação'
    if (path.includes('/members')) return 'Membros'
    if (path.includes('/giveaways')) return 'Sorteios'
    if (path.includes('/settings')) return 'Configurações'
    if (path.includes('/welcome')) return 'Boas-vindas'

    return 'Painel'
  }, [location.pathname, guildId])

  const subtitle = useMemo(() => {
    if (!guildId) return null
    return `Guild: ${truncate_middle(guildId)}`
  }, [guildId])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/75 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>

        <div className="flex items-center gap-3">
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
