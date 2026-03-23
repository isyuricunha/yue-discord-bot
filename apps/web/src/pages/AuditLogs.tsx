import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft, Search } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Input, Select, Skeleton } from '../components/ui'

import { AuditLogItem, getActionFormat } from './components/AuditLogItem'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

interface GuildConfig {
  prefix: string
  locale: string
  timezone: string
  auditLogChannelId?: string | null
}

export type audit_row = {
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

type audit_logs_response = {
  success: boolean
  logs: audit_row[]
  total: number
  limit?: number
  offset?: number
}


export default function AuditLogsPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch] = useState('')

  const {
    data: config_data,
    isLoading: is_config_loading,
  } = useQuery({
    queryKey: ['settings-config', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/settings-config`, { withCredentials: true })
      return response.data as { config: GuildConfig }
    },
  })

  const updateConfigMutation = useMutation({
    mutationFn: async (data: Partial<GuildConfig>) => {
      const response = await axios.put(`${API_URL}/api/guilds/${guildId}/settings-config`, data, { withCredentials: true })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-config', guildId] })
      toast_success('Canal de auditoria salvo!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar canal')
    },
  })

  const handleSaveAuditChannel = (val: string) => {
    updateConfigMutation.mutate({ auditLogChannelId: val === 'none' ? null : val })
  }

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
      return res.data as audit_logs_response
    },
  })

  // Resolvers
  const { data: membersRes } = useQuery({
    queryKey: ['members', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/members`, { withCredentials: true })
      return res.data as { members: any[] }
    },
    staleTime: 60000,
  })

  const { data: rolesRes } = useQuery({
    queryKey: ['roles', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/roles`, { withCredentials: true })
      return res.data as { roles: any[] }
    },
    staleTime: 60000,
  })

  const { data: channelsRes } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`, { withCredentials: true })
      return res.data as { channels: any[] }
    },
    staleTime: 60000,
  })

  const membersMap = useMemo(() => {
    const map = new Map<string, any>()
    membersRes?.members?.forEach(m => map.set(m.userId, m))
    return map
  }, [membersRes])

  const rolesMap = useMemo(() => {
    const map = new Map<string, any>()
    rolesRes?.roles?.forEach(r => map.set(r.id, r))
    return map
  }, [rolesRes])

  const channelsMap = useMemo(() => {
    const map = new Map<string, any>()
    channelsRes?.channels?.forEach((c: any) => map.set(c.id, c))
    return map
  }, [channelsRes])

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
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-accent/20 bg-card">
            <div>
              <div className="font-semibold flex items-center gap-2">Canal de Auditoria {config_data?.config?.auditLogChannelId && <span className="text-[10px] uppercase font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded">Ativo</span>}</div>
              <div className="text-sm text-muted-foreground mt-1">Selecione o canal onde o Bot enviará os logs da plataforma (edições, deleções, apelidos, cargos).</div>
            </div>
            <div className="w-full md:w-64 shrink-0">
                <Select 
                  value={config_data?.config?.auditLogChannelId || 'none'} 
                  onValueChange={(val) => handleSaveAuditChannel(val)}
                  disabled={is_config_loading || updateConfigMutation.isPending}
                >
                  <option value="none">Nenhum (Apenas web)</option>
                  {channelsRes?.channels?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.type === 0 ? '#' : c.type === 2 ? '🔊' : '📁'} {c.name}
                    </option>
                  ))}
                </Select>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="md:col-span-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ação</div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <option value="">Todas as Ações</option>
                {available_actions.map((a) => (
                  <option key={a} value={a}>
                    {getActionFormat(a).label}
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
            <div className="space-y-4">
              {filtered.slice(0, 100).map((l) => (
                <AuditLogItem key={l.id} log={l} membersMap={membersMap} rolesMap={rolesMap} channelsMap={channelsMap} />
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
