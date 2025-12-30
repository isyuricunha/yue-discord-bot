import * as React from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  LayoutDashboard,
  ChevronsLeft,
  ChevronsRight,
  Award,
  Image as ImageIcon,
  BarChart3,
  Shield,
  FileText,
  Users,
  Trophy,
  Sparkles,
  UserPlus,
  Settings,
} from 'lucide-react'

import { cn } from '../../lib/cn'

type nav_item = {
  to: string
  label: string
  icon: React.ReactNode
}

function sort_by_label_ptbr(items: nav_item[]) {
  return items.slice().sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
}

function nav_link_class({ isActive }: { isActive: boolean }) {
  return cn(
    'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
    'hover:bg-surface/70 hover:text-foreground',
    isActive ? 'bg-surface/80 text-foreground border border-border/80' : 'text-muted-foreground'
  )
}

type sidebar_props = {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: sidebar_props) {
  const { guildId } = useParams()

  const base: nav_item[] = sort_by_label_ptbr([
    {
      to: '/',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      to: '/badges',
      label: 'Badges',
      icon: <Award className="h-4 w-4" />,
    },
    {
      to: '/fanarts',
      label: 'Fan arts',
      icon: <ImageIcon className="h-4 w-4" />,
    },
  ])

  const guild: nav_item[] = guildId
    ? [
        ...sort_by_label_ptbr([
          {
            to: `/guild/${guildId}/automod`,
            label: 'AutoMod',
            icon: <Shield className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/autorole`,
            label: 'Autorole',
            icon: <UserPlus className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/welcome`,
            label: 'Boas-vindas',
            icon: <Sparkles className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/settings`,
            label: 'Configurações',
            icon: <Settings className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/modlogs`,
            label: 'Logs',
            icon: <FileText className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/members`,
            label: 'Membros',
            icon: <Users className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/moderation`,
            label: 'Moderação',
            icon: <Shield className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/giveaways`,
            label: 'Sorteios',
            icon: <Trophy className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/overview`,
            label: 'Visão geral',
            icon: <BarChart3 className="h-4 w-4" />,
          },
          {
            to: `/guild/${guildId}/xp`,
            label: 'XP',
            icon: <Sparkles className="h-4 w-4" />,
          },
        ]),
      ]
    : []

  const width = collapsed ? 'w-[72px]' : 'w-[260px]'

  return (
    <aside
      className={cn(
        'relative h-screen shrink-0 border-r border-border/80 bg-background/90 backdrop-blur-md',
        'transition-[width] duration-200 ease-out',
        width
      )}
    >
      <div className="flex h-full flex-col">
        <div className={cn('flex items-center justify-between px-4 py-4', collapsed && 'justify-center')}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-surface/80 border border-border/80">
                <img src="/icon.png" alt="Yue" className="h-5 w-5 rounded" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Yue</div>
                <div className="text-xs text-muted-foreground">Painel de Controle</div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-surface/50 text-muted-foreground',
              'hover:bg-surface/70 hover:text-foreground transition-colors'
            )}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className={cn('flex-1 space-y-1 px-3', collapsed && 'px-2')}>
          {base.map((item) => (
            <NavLink key={item.to} to={item.to} className={nav_link_class} end>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface/50 border border-border/70">
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}

          {guild.length > 0 && !collapsed && <div className="px-2 pt-4 text-xs text-muted-foreground">Guild</div>}

          {guild.map((item) => (
            <NavLink key={item.to} to={item.to} className={nav_link_class}>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface/50 border border-border/70">
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={cn('px-4 py-4', collapsed && 'px-2')}>
          <div className={cn('rounded-2xl border border-border/80 bg-surface/40 p-3', collapsed && 'p-2')}>
            <div className={cn('text-xs text-muted-foreground', collapsed && 'hidden')}>Status</div>
            <div className={cn('mt-1 flex items-center gap-2', collapsed && 'justify-center')}
            >
              <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_18px_rgba(255,106,0,0.35)]" />
              {!collapsed && <span className="text-xs">Online</span>}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
