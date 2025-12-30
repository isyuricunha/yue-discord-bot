import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useState } from 'react'
import { ArrowLeft, Shield, AlertTriangle, Ban, Volume2, FileWarning, Download, Search } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, EmptyState, ErrorState, Input, Skeleton } from '../components/ui'
import { get_modlog_action_label, normalize_modlog_action } from '../lib/modlog'

const API_URL = getApiUrl()

interface ModLog {
  id: string
  guildId: string
  action: string
  moderatorId: string
  moderatorName: string
  targetId: string
  targetName: string
  userId: string
  reason: string | null
  duration?: string | null
  metadata?: any
  createdAt: string
}

const actionIcons = {
  BAN: Ban,
  UNBAN: Ban,
  KICK: AlertTriangle,
  MUTE: Volume2,
  UNMUTE: Volume2,
  TIMEOUT: Volume2,
  UNTIMEOUT: Volume2,
  WARN: FileWarning,
  WARN_EXPIRED: FileWarning,
  MUTE_REAPPLY: Volume2,
  AUTOMOD: Shield,
}

const actionColors = {
  BAN: 'text-red-400',
  UNBAN: 'text-red-400',
  KICK: 'text-orange-400',
  MUTE: 'text-yellow-400',
  UNMUTE: 'text-yellow-400',
  TIMEOUT: 'text-yellow-400',
  UNTIMEOUT: 'text-yellow-400',
  WARN: 'text-blue-400',
  WARN_EXPIRED: 'text-blue-400',
  MUTE_REAPPLY: 'text-yellow-400',
  AUTOMOD: 'text-accent',
}

export default function ModLogsPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [page, setPage] = useState(1)
  const itemsPerPage = 20

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['modlogs', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/modlogs?limit=500`)
      return response.data
    },
  })

  const logs = data?.logs || []

  // Filtrar logs por tipo de ação e termo de busca
  const filteredLogs = logs.filter((log: ModLog) => {
    // Filtro por tipo de ação
    if (actionFilter !== 'all' && log.action.toLowerCase() !== actionFilter.toLowerCase()) {
      return false
    }

    // Filtro por termo de busca
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.userId.includes(searchTerm) ||
      log.moderatorId.includes(searchTerm) ||
      (log.reason && log.reason.toLowerCase().includes(searchLower))
    )
  })

  // Paginação
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const startIndex = (page - 1) * itemsPerPage
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage)

  const getActionBadgeVariant = (action: string) => {
    const normalized = action.toUpperCase()
    if (normalized === 'BAN' || normalized === 'KICK') return 'accent'
    return 'neutral'
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/guild/${guildId}/overview`)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div>
            <div className="text-xl font-semibold tracking-tight">Logs de moderação</div>
            <div className="mt-1 text-sm text-muted-foreground">Histórico de ações de moderação</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${API_URL}/api/guilds/${guildId}/modlogs/export?format=json&action=all`}
            download
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-surface/50 px-4 text-sm text-muted-foreground hover:bg-surface/70 hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            JSON
          </a>
          <a
            href={`${API_URL}/api/guilds/${guildId}/modlogs/export?format=csv&action=all`}
            download
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-surface/50 px-4 text-sm text-muted-foreground hover:bg-surface/70 hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            CSV
          </a>
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Erro ao carregar logs"
          description={(error as any)?.message || 'Não foi possível carregar os logs de moderação.'}
          onAction={() => void refetch()}
        />
      )}

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                placeholder="Buscar por ação, moderador, usuário, razão..."
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {searchTerm || actionFilter !== 'all' ? (
                <span>
                  {filteredLogs.length} resultado{filteredLogs.length !== 1 ? 's' : ''}
                </span>
              ) : (
                <span>{logs.length} logs</span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={actionFilter === 'all' ? 'solid' : 'outline'}
              onClick={() => {
                setActionFilter('all')
                setPage(1)
              }}
            >
              Todas ({logs.length})
            </Button>
            <Button
              size="sm"
              variant={actionFilter === 'ban' ? 'solid' : 'outline'}
              onClick={() => {
                setActionFilter('ban')
                setPage(1)
              }}
            >
              Ban ({logs.filter((l: ModLog) => l.action.toLowerCase() === 'ban').length})
            </Button>
            <Button
              size="sm"
              variant={actionFilter === 'kick' ? 'solid' : 'outline'}
              onClick={() => {
                setActionFilter('kick')
                setPage(1)
              }}
            >
              Kick ({logs.filter((l: ModLog) => l.action.toLowerCase() === 'kick').length})
            </Button>
            <Button
              size="sm"
              variant={actionFilter === 'mute' ? 'solid' : 'outline'}
              onClick={() => {
                setActionFilter('mute')
                setPage(1)
              }}
            >
              Mute ({logs.filter((l: ModLog) => l.action.toLowerCase() === 'mute').length})
            </Button>
            <Button
              size="sm"
              variant={actionFilter === 'warn' ? 'solid' : 'outline'}
              onClick={() => {
                setActionFilter('warn')
                setPage(1)
              }}
            >
              Warn ({logs.filter((l: ModLog) => l.action.toLowerCase() === 'warn').length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-3 h-4 w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title={searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum log de moderação encontrado'}
          description={searchTerm ? 'Tente usar termos diferentes.' : 'As ações de moderação aparecerão aqui.'}
        />
      ) : (
        <>
          <div className="space-y-3">
            {paginatedLogs.map((log: ModLog) => {
              const normalized_action = normalize_modlog_action(log.action)
              const action_label = get_modlog_action_label(log.action)
              const Icon = actionIcons[normalized_action as keyof typeof actionIcons] || Shield
              const color = actionColors[normalized_action as keyof typeof actionColors] || 'text-muted-foreground'

              const moderatorLabel = log.moderatorName || log.moderatorId || 'AutoMod'
              const targetLabel = log.targetName || log.targetId || log.userId || '—'

              const meta = log.metadata as any
              const messageMeta = meta?.message
              const actionMeta = meta?.action
              const ruleMeta = meta?.rule
              const detailsMeta = meta?.details

              return (
                <Card key={log.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-surface/60 ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getActionBadgeVariant(log.action)} className="uppercase">
                            {action_label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                        </div>

                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">Moderador:</span>{' '}
                          <span className="font-medium">{moderatorLabel}</span>
                          <span className="text-muted-foreground">{' → '}</span>
                          <span className="text-muted-foreground">Alvo:</span>{' '}
                          <span className="font-medium">{targetLabel}</span>
                        </div>

                        {log.reason && (
                          <div className="mt-3 rounded-xl border border-border/70 bg-surface/50 px-4 py-3">
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Motivo:</span> {log.reason}
                            </div>
                          </div>
                        )}

                        {(log.duration || messageMeta?.channelId || messageMeta?.excerpt || ruleMeta || detailsMeta || actionMeta) && (
                          <div className="mt-3 rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                            <div className="grid gap-1 text-xs text-muted-foreground">
                              {typeof actionMeta === 'string' && <div><span className="font-medium">Ação aplicada:</span> {String(actionMeta).toUpperCase()}</div>}
                              {typeof ruleMeta === 'string' && <div><span className="font-medium">Regra:</span> {ruleMeta}</div>}
                              {log.duration && <div><span className="font-medium">Duração:</span> {log.duration}</div>}
                              {messageMeta?.channelId && <div><span className="font-medium">Canal:</span> {messageMeta.channelId}</div>}
                              {messageMeta?.excerpt && <div><span className="font-medium">Mensagem:</span> {messageMeta.excerpt}</div>}
                              {detailsMeta?.capsPercentage !== undefined && detailsMeta?.capsThreshold !== undefined && (
                                <div>
                                  <span className="font-medium">CAPS:</span> {detailsMeta.capsPercentage}% (threshold {detailsMeta.capsThreshold}%)
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Página {page} de {totalPages} • {filteredLogs.length} resultados
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      Anterior
                    </Button>

                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (page <= 3) {
                          pageNum = i + 1
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = page - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            size="sm"
                            variant={page === pageNum ? 'solid' : 'outline'}
                            onClick={() => setPage(pageNum)}
                            className="w-10 px-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
