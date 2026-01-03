import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft, FileText, Search } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Input, Select, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

type audit_row = {
  id: string
  guildId: string
  action: string
  actorUserId: string | null
  targetUserId: string | null
  targetChannelId: string | null
  targetMessageId: string | null
  data: unknown
  createdAt: string
}

function format_ts_iso(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR')
}

export default function AuditLogsPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()

  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch] = useState('')

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['audit', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/audit`, {
        params: {
          limit: 200,
        },
      })
      return res.data as { logs: audit_row[]; total: number }
    },
  })

  const logs = data?.logs ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return logs.filter((l) => {
      if (actionFilter.trim() && l.action !== actionFilter.trim()) return false
      if (!q) return true

      const hay = [
        l.action,
        l.actorUserId ?? '',
        l.targetUserId ?? '',
        l.targetChannelId ?? '',
        l.targetMessageId ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return hay.includes(q)
    })
  }, [logs, actionFilter, search])

  const available_actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [logs])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/guild/${guildId}/overview`)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div>
            <div className="text-xl font-semibold tracking-tight">Audit logs</div>
            <div className="mt-1 text-sm text-muted-foreground">Eventos importantes do servidor</div>
          </div>
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Erro ao carregar audit logs"
          description="Não foi possível carregar os eventos."
          onAction={() => void refetch()}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ação</div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <option value="">Todas</option>
                {available_actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscar</div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="action / userId / channelId / messageId"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-surface/40 p-6 text-sm text-muted-foreground">
              Nenhum evento encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 100).map((l) => (
                <div key={l.id} className="rounded-2xl border border-border/70 bg-surface/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-accent" />
                        <div className="truncate text-sm font-semibold">{l.action}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{format_ts_iso(l.createdAt)}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">{l.id}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <div>actorUserId: {l.actorUserId ?? '—'}</div>
                    <div>targetUserId: {l.targetUserId ?? '—'}</div>
                    <div>targetChannelId: {l.targetChannelId ?? '—'}</div>
                    <div>targetMessageId: {l.targetMessageId ?? '—'}</div>
                  </div>

                  {l.data ? (
                    <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-surface/60 p-3 text-xs text-foreground">
                      {JSON.stringify(l.data, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}

              {filtered.length > 100 ? (
                <div className="text-xs text-muted-foreground">Mostrando 100 de {filtered.length}.</div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
