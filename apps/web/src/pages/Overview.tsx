import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Users, Shield, Trophy, AlertCircle, Settings, FileText } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, EmptyState, ErrorState, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

type guild_summary = {
  id: string
  name: string
  icon: string | null
}

interface GuildStats {
  totalMembers: number
  moderationActions7d: number
  moderationActions30d: number
  activeGiveaways: number
  totalGiveaways: number
  bannedWords: number
  recentActions: {
    id: string
    action: string
    userId: string
    moderatorId: string
    reason: string | null
    createdAt: string
  }[]
  actionsByType?: Record<string, number>
}

export default function OverviewPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()

  const {
    data: guild,
    isLoading: guildLoading,
    isError: isGuildError,
    error: guildError,
    refetch: refetchGuild,
  } = useQuery({
    queryKey: ['guild', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}`)
      return (response.data as { guild: guild_summary }).guild
    },
  })

  const {
    data: stats,
    isLoading: statsLoading,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['guild-stats', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/stats`)
      return response.data as GuildStats
    },
  })

  const is_loading = guildLoading || statsLoading
  const is_error = isGuildError || isStatsError

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/guild/${guildId}`)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            {is_loading ? (
              <Skeleton className="h-11 w-11 rounded-full" />
            ) : guild?.icon ? (
              <img
                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                alt={guild.name}
                className="h-11 w-11 rounded-full"
              />
            ) : (
              <div className="h-11 w-11 rounded-full border border-border/70 bg-surface/60" />
            )}
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold tracking-tight">
                {is_loading ? <Skeleton className="h-6 w-52" /> : guild?.name || 'Guild'}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Visão geral</div>
            </div>
          </div>
        </div>

        <Button onClick={() => navigate(`/guild/${guildId}/settings`)}>
          <Settings className="h-4 w-4" />
          Configurações
        </Button>
      </div>

      {is_error && (
        <ErrorState
          title="Erro ao carregar dados"
          description={(guildError as any)?.message || (statsError as any)?.message || 'Erro desconhecido'}
          onAction={() => {
            void refetchGuild()
            void refetchStats()
          }}
        />
      )}

      <Card>
        <CardContent className="p-6">
          <div className="text-sm font-medium">Ações rápidas</div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              onClick={() => navigate(`/guild/${guildId}/automod`)}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface/40 px-4 py-3 text-left transition-colors hover:bg-surface/60"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-surface/60">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div>
                <div className="text-sm font-semibold">AutoMod</div>
                <div className="text-xs text-muted-foreground">Filtros e regras</div>
              </div>
            </button>

            <button
              onClick={() => navigate(`/guild/${guildId}/modlogs`)}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface/40 px-4 py-3 text-left transition-colors hover:bg-surface/60"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-surface/60">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div>
                <div className="text-sm font-semibold">Logs</div>
                <div className="text-xs text-muted-foreground">Histórico de ações</div>
              </div>
            </button>

            <button
              onClick={() => navigate(`/guild/${guildId}/members`)}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface/40 px-4 py-3 text-left transition-colors hover:bg-surface/60"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-surface/60">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <div className="text-sm font-semibold">Membros</div>
                <div className="text-xs text-muted-foreground">Lista e perfis</div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {is_loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-3 h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Total de membros</div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{stats?.totalMembers?.toLocaleString() || '0'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Ações (7 dias)</div>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{stats?.moderationActions7d || '0'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Sorteios ativos</div>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{stats?.activeGiveaways || '0'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Palavras bloqueadas</div>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{stats?.bannedWords || '0'}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {Boolean(stats?.actionsByType && Object.keys(stats.actionsByType).length > 0) && (
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium">Distribuição de ações (7 dias)</div>
            <div className="mt-5 space-y-4">
              {Object.entries(stats!.actionsByType!)
                .sort(([, a], [, b]) => b - a)
                .map(([action, count]) => {
                  const maxCount = Math.max(...Object.values(stats!.actionsByType!))
                  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0

                  return (
                    <div key={action} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium uppercase text-muted-foreground">{action}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface/70">
                        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="text-sm font-medium">Ações recentes</div>

          {!stats?.recentActions || stats.recentActions.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Nenhuma ação registrada" description="Quando ocorrerem ações de moderação, elas aparecerão aqui." />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {stats.recentActions.map((action) => (
                <div
                  key={action.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface/40 p-4 transition-colors hover:bg-surface/60 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Badge variant="neutral" className="uppercase">
                      {action.action}
                    </Badge>
                    <div className="min-w-0">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Usuário:</span> <span className="font-medium">{action.userId}</span>
                      </div>
                      {action.reason && (
                        <div className="mt-1 break-words text-sm text-muted-foreground">Razão: {action.reason}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{new Date(action.createdAt).toLocaleString('pt-BR')}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!is_loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium">Resumo de moderação</div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Últimos 7 dias</span>
                  <span className="text-sm font-semibold">{stats?.moderationActions7d || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Últimos 30 dias</span>
                  <span className="text-sm font-semibold">{stats?.moderationActions30d || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium">Resumo de sorteios</div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ativos</span>
                  <span className="text-sm font-semibold">{stats?.activeGiveaways || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-sm font-semibold">{stats?.totalGiveaways || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
