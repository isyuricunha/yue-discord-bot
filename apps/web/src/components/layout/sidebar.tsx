/**
 * Sidebar principal de navegação
 *
 * @param {Object} props - Props do componente
 * @param {boolean} props.collapsed - Estado de colapso
 * @param {function} props.onToggle - Callback para alternar estado
 * @returns {JSX.Element} Sidebar renderizada
 */
import * as React from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  LayoutDashboard,
  ChevronsLeft,
  ChevronsRight,
  Crown,
  Award,
  Image as ImageIcon,
  BarChart3,
  Coins,
  Swords,
  Shield,
  ShieldAlert,
  FileText,
  ClipboardList,
  TerminalSquare,
  Wand2,
  LifeBuoy,
  Lightbulb,
  MousePointerClick,
  Star,
  Users,
  Trophy,
  UserPlus,
  Settings,
  ExternalLink,
  Music,
  Command,
  ScanEye,
  Heart,
  TrendingUp,
  Gift,
  Radio,
} from 'lucide-react'

import { cn } from '../../lib/cn'
import { useAuthStore } from '../../store/auth'

type nav_item = {
  to: string
  label: string
  icon: React.ReactNode
}

type nav_section = {
  title: string
  items: nav_item[]
}

function sort_by_label_ptbr(items: nav_item[]) {
  return items.slice().sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
}

function nav_link_class({ isActive }: { isActive: boolean }) {
  return cn(
    'group flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 text-[13px] transition-colors outline-none',
    'hover:bg-cursor-bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-accent',
    isActive ? 'border-l-accent bg-cursor-accent-soft text-white' : 'text-muted-foreground'
  )
}

function nav_link_class_static() {
  return cn(
    'group flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 text-[13px] transition-colors outline-none',
    'hover:bg-cursor-bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-accent',
    'text-muted-foreground cursor-pointer'
  )
}

type sidebar_props = {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: sidebar_props) {
  const { guildId } = useParams()
  const { user } = useAuthStore()

  const base_items: nav_item[] = [
    {
      to: '/',
      label: 'Painel',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      to: '/coinflip',
      label: 'Cara ou Coroa',
      icon: <Swords className="h-4 w-4" />,
    },
    {
      to: '/economy',
      label: 'Economia',
      icon: <Coins className="h-4 w-4" />,
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
  ]

  if (user?.isOwner) {
    base_items.push({
      to: '/owner',
      label: 'Owner',
      icon: <Crown className="h-4 w-4" />,
    })
  }

  const base: nav_item[] = sort_by_label_ptbr(base_items)

  const guild_sections: nav_section[] = guildId
    ? [
      {
        title: 'Primeiros passos',
        items: [
          { to: `/guild/${guildId}`, label: 'Painel', icon: <LayoutDashboard className="h-4 w-4" /> },
          { to: `/guild/${guildId}/setup`, label: 'Setup', icon: <Wand2 className="h-4 w-4" /> },
          { to: `/guild/${guildId}/overview`, label: 'Visão geral', icon: <BarChart3 className="h-4 w-4" /> },
          { to: `/guild/${guildId}/commands`, label: 'Comandos', icon: <TerminalSquare className="h-4 w-4" /> },
        ],
      },
      {
        title: 'Moderação & logs',
        items: [
          { to: `/guild/${guildId}/moderation`, label: 'Moderação', icon: <Shield className="h-4 w-4" /> },
          { to: `/guild/${guildId}/antiraid`, label: 'Anti-Raide', icon: <ShieldAlert className="h-4 w-4" /> },
          { to: `/guild/${guildId}/automod`, label: 'AutoMod', icon: <ScanEye className="h-4 w-4" /> },
          { to: `/guild/${guildId}/modlogs`, label: 'Logs', icon: <FileText className="h-4 w-4" /> },
          { to: `/guild/${guildId}/audit`, label: 'Audit', icon: <ClipboardList className="h-4 w-4" /> },
        ],
      },
      {
        title: 'Automações',
        items: [
          { to: `/guild/${guildId}/autorole`, label: 'Autorole', icon: <UserPlus className="h-4 w-4" /> },
          { to: `/guild/${guildId}/welcome`, label: 'Boas-vindas', icon: <Heart className="h-4 w-4" /> },
        ],
      },
      {
        title: 'Engajamento',
        items: [
          { to: `/guild/${guildId}/music`, label: 'Música', icon: <Music className="h-4 w-4" /> },
          { to: `/guild/${guildId}/custom-commands`, label: 'Custom Commands', icon: <Command className="h-4 w-4" /> },
          { to: `/guild/${guildId}/keyword-triggers`, label: 'Gatilhos', icon: <Radio className="h-4 w-4" /> },
          { to: `/guild/${guildId}/xp`, label: 'XP', icon: <TrendingUp className="h-4 w-4" /> },
          { to: `/guild/${guildId}/reaction-roles`, label: 'Reaction Roles', icon: <MousePointerClick className="h-4 w-4" /> },
          { to: `/guild/${guildId}/starboard`, label: 'Starboard', icon: <Star className="h-4 w-4" /> },
          { to: `/guild/${guildId}/suggestions`, label: 'Sugestões', icon: <Lightbulb className="h-4 w-4" /> },
          { to: `/guild/${guildId}/free-games`, label: 'Jogos Grátis', icon: <Gift className="h-4 w-4" /> },
        ],
      },
      {
        title: 'Suporte',
        items: [{ to: `/guild/${guildId}/tickets`, label: 'Tickets', icon: <LifeBuoy className="h-4 w-4" /> }],
      },
      {
        title: 'Admin',
        items: [
          { to: `/guild/${guildId}/members`, label: 'Membros', icon: <Users className="h-4 w-4" /> },
          { to: `/guild/${guildId}/giveaways`, label: 'Sorteios', icon: <Trophy className="h-4 w-4" /> },
          { to: `/guild/${guildId}/settings`, label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
        ],
      },
    ]
    : []

  const width = collapsed ? 'w-[56px]' : 'w-[260px]'

  return (
    <aside
      id="sidebar"
      className={cn(
        'relative h-screen shrink-0 overflow-hidden border-r border-border/80 bg-cursor-bg-sidebar',
        'transition-[width] duration-[160ms] ease-cursor',
        width
      )}
      role="navigation"
      aria-label="Barra lateral principal de navegação"
      aria-expanded={!collapsed}
    >
      <div className="flex h-full flex-col">
        <div className={cn('flex h-12 items-center justify-between border-b border-border/60 px-3', collapsed && 'justify-center px-2')}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-surface border border-border/80">
                <img src="/icon.png" alt="Yue logo - Control panel" className="h-5 w-5 rounded" />
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold text-white">Yue</div>
                <div className="text-xs text-muted-foreground">Painel de Controle</div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-transparent text-muted-foreground',
              'hover:bg-cursor-bg-hover hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-accent'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="sidebar-content"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav id="sidebar-content" className={cn('scrollbar-yue min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2', collapsed && 'px-1.5')}>
          {base.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={nav_link_class}
              end
              title={collapsed ? item.label : undefined}
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-surface border border-border/70">
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}

          <a
            href="/extras"
            target="_blank"
            rel="noreferrer"
            className={nav_link_class_static()}
            aria-label="Open Extras in a new tab"
            title={collapsed ? 'Extras' : undefined}
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-surface border border-border/70">
              <ExternalLink className="h-4 w-4" />
            </span>
            {!collapsed && <span className="truncate">Extras</span>}
          </a>

          {guild_sections.map((section) => (
            <React.Fragment key={section.title}>
              {section.items.length > 0 && !collapsed && (
                <div className="px-2 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground" role="group" aria-label={section.title}>
                  {section.title}
                </div>
              )}

              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={nav_link_class}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-surface border border-border/70">
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </nav>

        <div className={cn('border-t border-border/60 px-3 py-3', collapsed && 'px-2')}>
          <div className={cn('rounded-md border border-border/80 bg-surface p-2.5', collapsed && 'p-2')}>
            <div className={cn('text-xs text-muted-foreground', collapsed && 'hidden')}>Status</div>
            <div className={cn('mt-1 flex items-center gap-2', collapsed && 'justify-center')}
            >
              <span className="h-2 w-2 rounded-full bg-cursor-success" />
              {!collapsed && <span className="text-xs">Online</span>}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
