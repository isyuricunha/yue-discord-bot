import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import axios from 'axios'
import {
  BarChart3,
  Shield,
  Trophy,
  FileText,
  Users,
  Settings,
  Sparkles,
  UserPlus,
  LifeBuoy,
  Wand2,
  Lightbulb,
  MousePointerClick,
  Star,
  TerminalSquare,
  ClipboardList,
  TrendingUp,
  Music,
} from 'lucide-react'

import { getApiUrl } from '../env'
import { Card, CardContent, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

interface Guild {
  id: string
  name: string
  icon: string | null
}

type module_card = {
  to: string
  label: string
  description: string
  icon: React.ReactNode
  category: 'essentials' | 'automation' | 'engagement' | 'support' | 'admin'
}

function useGuildModules(guildId: string) {
  return useMemo(() => {
    const modules: module_card[] = [
      {
        to: `/guild/${guildId}/setup`,
        label: 'Setup',
        description: 'Configuração guiada inicial',
        icon: <Wand2 className="h-5 w-5" />,
        category: 'essentials',
      },
      {
        to: `/guild/${guildId}/overview`,
        label: 'Visão geral',
        description: 'Estatísticas e resumo',
        icon: <BarChart3 className="h-5 w-5" />,
        category: 'essentials',
      },
      {
        to: `/guild/${guildId}/commands`,
        label: 'Comandos',
        description: 'Lista do que o bot oferece',
        icon: <TerminalSquare className="h-5 w-5" />,
        category: 'essentials',
      },
      {
        to: `/guild/${guildId}/moderation`,
        label: 'Moderação',
        description: 'Filtros e punições',
        icon: <Shield className="h-5 w-5" />,
        category: 'automation',
      },
      {
        to: `/guild/${guildId}/welcome`,
        label: 'Boas-vindas',
        description: 'Mensagens automáticas',
        icon: <Sparkles className="h-5 w-5" />,
        category: 'automation',
      },
      {
        to: `/guild/${guildId}/autorole`,
        label: 'Autorole',
        description: 'Cargos para novos membros',
        icon: <UserPlus className="h-5 w-5" />,
        category: 'automation',
      },
      {
        to: `/guild/${guildId}/xp`,
        label: 'XP & Níveis',
        description: 'Sistema de ranking',
        icon: <TrendingUp className="h-5 w-5" />,
        category: 'engagement',
      },
      {
        to: `/guild/${guildId}/reaction-roles`,
        label: 'Cargos por reação',
        description: 'Painéis de cargos',
        icon: <MousePointerClick className="h-5 w-5" />,
        category: 'engagement',
      },
      {
        to: `/guild/${guildId}/starboard`,
        label: 'Starboard',
        description: 'Destaque mensagens',
        icon: <Star className="h-5 w-5" />,
        category: 'engagement',
      },
      {
        to: `/guild/${guildId}/suggestions`,
        label: 'Sugestões',
        description: 'Canal de ideias',
        icon: <Lightbulb className="h-5 w-5" />,
        category: 'engagement',
      },
      {
        to: `/guild/${guildId}/custom-commands`,
        label: 'Comandos personalizados',
        description: 'Respostas e automações',
        icon: <TerminalSquare className="h-5 w-5" />,
        category: 'engagement',
      },
      {
        to: `/guild/${guildId}/music`,
        label: 'Música',
        description: 'Player e playlists',
        icon: <Music className="h-5 w-5" />,
        category: 'engagement',
      },
      {
        to: `/guild/${guildId}/tickets`,
        label: 'Tickets',
        description: 'Suporte e painel',
        icon: <LifeBuoy className="h-5 w-5" />,
        category: 'support',
      },
      {
        to: `/guild/${guildId}/members`,
        label: 'Membros',
        description: 'Gerenciar usuários',
        icon: <Users className="h-5 w-5" />,
        category: 'admin',
      },
      {
        to: `/guild/${guildId}/giveaways`,
        label: 'Sorteios',
        description: 'Criar e gerenciar',
        icon: <Trophy className="h-5 w-5" />,
        category: 'admin',
      },
      {
        to: `/guild/${guildId}/settings`,
        label: 'Configurações',
        description: 'Preferências gerais',
        icon: <Settings className="h-5 w-5" />,
        category: 'admin',
      },
      {
        to: `/guild/${guildId}/modlogs`,
        label: 'Logs',
        description: 'Histórico de ações',
        icon: <FileText className="h-5 w-5" />,
        category: 'admin',
      },
      {
        to: `/guild/${guildId}/audit`,
        label: 'Auditoria',
        description: 'Eventos importantes',
        icon: <ClipboardList className="h-5 w-5" />,
        category: 'admin',
      },
    ]
    return modules
  }, [guildId])
}

const category_labels: Record<module_card['category'], string> = {
  essentials: 'Primeiros passos',
  automation: 'Automação',
  engagement: 'Engajamento',
  support: 'Suporte',
  admin: 'Administração',
}

const category_order: module_card['category'][] = ['essentials', 'automation', 'engagement', 'support', 'admin']

export default function GuildPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()
  const modules = useGuildModules(guildId ?? '')

  const { data: guild, isLoading } = useQuery({
    queryKey: ['guild-summary', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/summary`)
      return response.data.guild as Guild
    },
  })

  const groupedModules = useMemo(() => {
    const grouped: Record<string, module_card[]> = {}
    for (const cat of category_order) {
      grouped[cat] = modules.filter((m: module_card) => m.category === cat)
    }
    return grouped
  }, [modules])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          {isLoading ? (
            <Skeleton className="h-14 w-14 rounded-2xl" />
          ) : guild?.icon ? (
            <img
              src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
              alt={guild.name}
              className="h-14 w-14 rounded-2xl"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border/80 bg-surface/70 text-lg font-semibold">
              <span className="text-accent">{guild?.name.charAt(0) ?? '?'}</span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold tracking-tight">
              {isLoading ? <Skeleton className="h-4 w-40" /> : guild?.name ?? 'Servidor'}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {isLoading ? <Skeleton className="h-3 w-56" /> : 'Painel de gerenciamento do servidor'}
            </div>
          </div>
        </CardContent>
      </Card>

      {!isLoading && !guild && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-base font-semibold">Servidor não encontrado</div>
            <div className="mt-2 text-sm text-muted-foreground">Verifique se você tem acesso a este servidor.</div>
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        category_order.map((category) => {
          const items = groupedModules[category]
          if (!items || items.length === 0) return null

          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {category_labels[category]}
                </h2>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <Card
                    key={item.to}
                    className="group cursor-pointer transition-all hover:border-accent/40 hover:shadow-sm"
                    onClick={() => navigate(item.to)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent transition-colors group-hover:bg-accent/10">
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold group-hover:text-accent transition-colors">
                            {item.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
    </div>
  )
}
