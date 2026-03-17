import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, X, CornerDownLeft, LayoutDashboard, Shield, Trophy, FileText, Users, Settings, Sparkles, UserPlus, LifeBuoy, Wand2, Lightbulb, MousePointerClick, Star, TerminalSquare, ClipboardList, BarChart3, Crown, Award, ImageIcon, Coins, Swords, Command } from 'lucide-react'
import { cn } from '../lib/cn'
import { useAuthStore } from '../store/auth'

type command_item = {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  to: string
  keywords: string[]
  requiresGuild?: boolean
  requiresOwner?: boolean
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const navigate = useNavigate()
  const { guildId } = useParams()
  const { user } = useAuthStore()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const commands: command_item[] = React.useMemo(() => {
    const base: command_item[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'Ver todos os servidores',
        icon: <LayoutDashboard className="h-4 w-4" />,
        to: '/',
        keywords: ['home', 'inicio', 'servidores', 'guilds', 'servers'],
      },
      {
        id: 'badges',
        label: 'Badges',
        description: 'Gerenciar badges do usuário',
        icon: <Award className="h-4 w-4" />,
        to: '/badges',
        keywords: ['emblemas', 'conquistas', 'achievements'],
      },
      {
        id: 'economy',
        label: 'Economia',
        description: 'Sistema econômico global',
        icon: <Coins className="h-4 w-4" />,
        to: '/economy',
        keywords: ['coins', 'dinheiro', 'money', 'balance'],
      },
      {
        id: 'coinflip',
        label: 'Cara ou Coroa',
        description: 'Jogar cara ou coroa',
        icon: <Swords className="h-4 w-4" />,
        to: '/coinflip',
        keywords: ['flip', 'coin', 'jogo', 'game', 'aposta'],
      },
      {
        id: 'fanarts',
        label: 'Fan Arts',
        description: 'Galeria de fan arts',
        icon: <ImageIcon className="h-4 w-4" />,
        to: '/fanarts',
        keywords: ['artes', 'gallery', 'imagens'],
      },
    ]

    if (user?.isOwner) {
      base.push({
        id: 'owner',
        label: 'Painel Owner',
        description: 'Administração do bot',
        icon: <Crown className="h-4 w-4" />,
        to: '/owner',
        keywords: ['admin', 'owner', 'painel', 'controle', 'administracao'],
        requiresOwner: true,
      })
    }

    if (!guildId) return base

    const guildCommands: command_item[] = [
      {
        id: 'guild-overview',
        label: 'Visão Geral do Servidor',
        description: 'Estatísticas e resumo',
        icon: <BarChart3 className="h-4 w-4" />,
        to: `/guild/${guildId}/overview`,
        keywords: ['stats', 'estatisticas', 'resumo', 'dashboard'],
        requiresGuild: true,
      },
      {
        id: 'guild-setup',
        label: 'Setup Wizard',
        description: 'Configuração guiada inicial',
        icon: <Wand2 className="h-4 w-4" />,
        to: `/guild/${guildId}/setup`,
        keywords: ['wizard', 'configuracao', 'inicial', 'setup'],
        requiresGuild: true,
      },
      {
        id: 'guild-commands',
        label: 'Comandos do Servidor',
        description: 'Lista de comandos disponíveis',
        icon: <TerminalSquare className="h-4 w-4" />,
        to: `/guild/${guildId}/commands`,
        keywords: ['commands', 'comandos', 'ajuda', 'help'],
        requiresGuild: true,
      },
      {
        id: 'guild-automod',
        label: 'AutoMod',
        description: 'Moderação automática',
        icon: <Shield className="h-4 w-4" />,
        to: `/guild/${guildId}/automod`,
        keywords: ['automod', 'moderacao', 'filtros', 'spam', 'raid'],
        requiresGuild: true,
      },
      {
        id: 'guild-moderation',
        label: 'Moderação',
        description: 'Configurações de punição',
        icon: <Shield className="h-4 w-4" />,
        to: `/guild/${guildId}/moderation`,
        keywords: ['mod', 'ban', 'kick', 'mute', 'warn', 'punicao'],
        requiresGuild: true,
      },
      {
        id: 'guild-modlogs',
        label: 'Logs de Moderação',
        description: 'Histórico de ações',
        icon: <FileText className="h-4 w-4" />,
        to: `/guild/${guildId}/modlogs`,
        keywords: ['logs', 'historico', 'acoes', 'modlogs'],
        requiresGuild: true,
      },
      {
        id: 'guild-audit',
        label: 'Audit Log',
        description: 'Eventos importantes',
        icon: <ClipboardList className="h-4 w-4" />,
        to: `/guild/${guildId}/audit`,
        keywords: ['audit', 'eventos', 'changes', 'alteracoes'],
        requiresGuild: true,
      },
      {
        id: 'guild-welcome',
        label: 'Boas-vindas',
        description: 'Mensagens de entrada',
        icon: <Sparkles className="h-4 w-4" />,
        to: `/guild/${guildId}/welcome`,
        keywords: ['welcome', 'entrada', 'mensagem', 'join'],
        requiresGuild: true,
      },
      {
        id: 'guild-autorole',
        label: 'Autorole',
        description: 'Cargos automáticos',
        icon: <UserPlus className="h-4 w-4" />,
        to: `/guild/${guildId}/autorole`,
        keywords: ['autorole', 'cargos', 'roles', 'automatico'],
        requiresGuild: true,
      },
      {
        id: 'guild-xp',
        label: 'XP e Níveis',
        description: 'Sistema de ranking',
        icon: <Sparkles className="h-4 w-4" />,
        to: `/guild/${guildId}/xp`,
        keywords: ['xp', 'levels', 'niveis', 'ranking', 'levelup'],
        requiresGuild: true,
      },
      {
        id: 'guild-reaction-roles',
        label: 'Reaction Roles',
        description: 'Cargos por reação',
        icon: <MousePointerClick className="h-4 w-4" />,
        to: `/guild/${guildId}/reaction-roles`,
        keywords: ['reaction', 'roles', 'cargos', 'reacao', 'emoji'],
        requiresGuild: true,
      },
      {
        id: 'guild-starboard',
        label: 'Starboard',
        description: 'Destaque de mensagens',
        icon: <Star className="h-4 w-4" />,
        to: `/guild/${guildId}/starboard`,
        keywords: ['star', 'starboard', 'destaque', 'favoritos'],
        requiresGuild: true,
      },
      {
        id: 'guild-suggestions',
        label: 'Sugestões',
        description: 'Sistema de sugestões',
        icon: <Lightbulb className="h-4 w-4" />,
        to: `/guild/${guildId}/suggestions`,
        keywords: ['suggestions', 'sugestoes', 'ideias', 'feedback'],
        requiresGuild: true,
      },
      {
        id: 'guild-custom-commands',
        label: 'Comandos Personalizados',
        description: 'Criar comandos customizados',
        icon: <Command className="h-4 w-4" />,
        to: `/guild/${guildId}/custom-commands`,
        keywords: ['custom', 'commands', 'personalizado', 'tags'],
        requiresGuild: true,
      },
      {
        id: 'guild-music',
        label: 'Música',
        description: 'Player de música',
        icon: <TerminalSquare className="h-4 w-4" />,
        to: `/guild/${guildId}/music`,
        keywords: ['music', 'musica', 'player', 'som', 'audio'],
        requiresGuild: true,
      },
      {
        id: 'guild-tickets',
        label: 'Tickets',
        description: 'Sistema de suporte',
        icon: <LifeBuoy className="h-4 w-4" />,
        to: `/guild/${guildId}/tickets`,
        keywords: ['tickets', 'suporte', 'support', 'ajuda'],
        requiresGuild: true,
      },
      {
        id: 'guild-members',
        label: 'Membros',
        description: 'Gerenciar membros',
        icon: <Users className="h-4 w-4" />,
        to: `/guild/${guildId}/members`,
        keywords: ['members', 'membros', 'usuarios', 'users'],
        requiresGuild: true,
      },
      {
        id: 'guild-giveaways',
        label: 'Sorteios',
        description: 'Criar sorteios',
        icon: <Trophy className="h-4 w-4" />,
        to: `/guild/${guildId}/giveaways`,
        keywords: ['giveaways', 'sorteios', 'giveaway', 'prize'],
        requiresGuild: true,
      },
      {
        id: 'guild-settings',
        label: 'Configurações',
        description: 'Preferências do servidor',
        icon: <Settings className="h-4 w-4" />,
        to: `/guild/${guildId}/settings`,
        keywords: ['settings', 'configuracoes', 'prefs', 'opcoes'],
        requiresGuild: true,
      },
    ]

    return [...base, ...guildCommands]
  }, [guildId, user?.isOwner])

  const filteredCommands = React.useMemo(() => {
    if (!query.trim()) return commands
    const lowerQuery = query.toLowerCase()
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery) ||
        cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))
    )
  }, [commands, query])

  React.useEffect(() => {
    setSelectedIndex(0)
  }, [query, filteredCommands.length])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  React.useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const handleSelect = (command: command_item) => {
    navigate(command.to)
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
    } else if (e.key === 'Enter' && filteredCommands.length > 0) {
      e.preventDefault()
      handleSelect(filteredCommands[selectedIndex])
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'flex items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-black shadow-lg',
          'hover:bg-accent/90 transition-all hover:shadow-xl hover:scale-105',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
        )}
        aria-label="Abrir Command Palette (Cmd+K)"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono sm:inline">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div
        className={cn(
          'relative w-full max-w-xl overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, comandos..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Buscar"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="rounded border border-border/80 bg-surface/60 px-2 py-1 text-xs font-mono text-muted-foreground">
              ESC
            </kbd>
            <button
              onClick={() => setIsOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-surface/70 hover:text-foreground transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado para &quot;{query}&quot;
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={() => handleSelect(command)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-accent/10 text-foreground'
                      : 'text-muted-foreground hover:bg-surface/60'
                  )}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface/60 text-accent">
                    {command.icon}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{command.label}</div>
                    <div className="text-xs text-muted-foreground">{command.description}</div>
                  </div>
                  {index === selectedIndex && (
                    <CornerDownLeft className="h-4 w-4 text-accent" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/80 bg-surface/30 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-surface/60 px-1.5 py-0.5 font-mono">↑</kbd>
              <kbd className="rounded border border-border/60 bg-surface/60 px-1.5 py-0.5 font-mono">↓</kbd>
              <span>navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-surface/60 px-1.5 py-0.5 font-mono">↵</kbd>
              <span>selecionar</span>
            </span>
          </div>
          <span>{filteredCommands.length} resultados</span>
        </div>
      </div>
    </div>
  )
}
