import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Lightbulb, Save } from 'lucide-react'

import type { suggestion_timeframe } from '@yuebot/shared'
import { suggestion_timeframe_label } from '@yuebot/shared'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Select, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type api_channel = {
  id: string
  name: string
  type: number
}

type suggestion_config = {
  enabled: boolean
  channelId: string | null
  logChannelId: string | null
}

type api_suggestion = {
  id: string
  userId: string
  sourceChannelId: string
  sourceMessageId: string
  messageId: string
  content: string
  status: 'pending' | 'accepted' | 'denied' | string
  upvotes: number
  downvotes: number
  decidedAt: string | null
  decidedByUserId: string | null
  decisionNote: string | null
  createdAt: string
  updatedAt: string
}

function channel_label(ch: api_channel) {
  return `#${ch.name}`
}

const CHANNEL_TYPE_GUILD_TEXT = 0
const CHANNEL_TYPE_GUILD_ANNOUNCEMENT = 5

export default function SuggestionsPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()
  const has_initialized = useRef(false)

  const [config, set_config] = useState<suggestion_config | null>(null)
  const [status_filter, set_status_filter] = useState<'all' | 'pending' | 'accepted' | 'denied'>('pending')
  const [top_timeframe, set_top_timeframe] = useState<suggestion_timeframe>('30d')

  const set_status_filter_safe = (value: string) => {
    if (value === 'pending' || value === 'accepted' || value === 'denied' || value === 'all') {
      set_status_filter(value)
    }
  }

  const {
    data: channels_data,
    isLoading: is_channels_loading,
    isError: is_channels_error,
    refetch: refetch_channels,
  } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return res.data as { success: boolean; channels: api_channel[] }
    },
  })

  const {
    data: config_data,
    isLoading: is_config_loading,
    isError: is_config_error,
    refetch: refetch_config,
  } = useQuery({
    queryKey: ['suggestion-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/suggestion-config`)
      return res.data as { success: boolean; config: suggestion_config }
    },
  })

  useEffect(() => {
    if (!config_data?.config) return
    if (has_initialized.current) return
    has_initialized.current = true

    set_config({
      enabled: Boolean(config_data.config.enabled),
      channelId: config_data.config.channelId ?? null,
      logChannelId: config_data.config.logChannelId ?? null,
    })
  }, [config_data])

  const channels = useMemo(() => {
    const list = channels_data?.channels ?? []
    return list.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [channels_data])

  const text_channels = useMemo(
    () => channels.filter((c) => c.type === CHANNEL_TYPE_GUILD_TEXT || c.type === CHANNEL_TYPE_GUILD_ANNOUNCEMENT),
    [channels]
  )

  const save_mutation = useMutation({
    mutationFn: async (payload: suggestion_config) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/suggestion-config`, {
        enabled: payload.enabled,
        channelId: payload.channelId,
        logChannelId: payload.logChannelId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestion-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const suggestions_query = useInfiniteQuery({
    queryKey: ['suggestions', guildId, status_filter],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit: 25 }
      if (status_filter !== 'all') params.status = status_filter
      if (typeof pageParam === 'string' && pageParam) params.cursor = pageParam

      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/suggestions`, { params })
      return res.data as { success: boolean; suggestions: api_suggestion[]; nextCursor: string | null }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const top_suggestions_query = useQuery({
    queryKey: ['suggestions-top', guildId, top_timeframe],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/suggestions/top`, {
        params: { timeframe: top_timeframe, limit: 25 },
      })

      return res.data as {
        success: boolean
        timeframe: suggestion_timeframe
        since: string
        suggestions: api_suggestion[]
      }
    },
  })

  const all_suggestions = useMemo(() => {
    const pages = suggestions_query.data?.pages ?? []
    return pages.flatMap((p) => p.suggestions ?? [])
  }, [suggestions_query.data])

  const is_loading = is_channels_loading || is_config_loading
  const is_error = is_channels_error || is_config_error

  const handle_save = () => {
    if (!config) return
    save_mutation.mutate(config)
  }

  const is_save_disabled =
    !config ||
    is_loading ||
    (config.enabled && (!config.channelId || config.channelId.trim().length === 0))

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Sugestões</div>
            <div className="text-sm text-muted-foreground">Configuração e lista de sugestões do servidor</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => {
              refetch_channels()
              refetch_config()
              suggestions_query.refetch()
            }}
          >
            Atualizar
          </Button>

          <Button onClick={handle_save} isLoading={save_mutation.isPending} disabled={is_save_disabled} className="shrink-0">
            <Save className="h-4 w-4" />
            <span>Salvar</span>
          </Button>
        </div>
      </div>

      {is_error && (
        <ErrorState
          title="Erro ao carregar sugestões"
          description="Não foi possível buscar canais/configurações de sugestões."
          actionLabel="Tentar novamente"
          onAction={() => {
            refetch_channels()
            refetch_config()
          }}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Ativar sugestões</div>
              <div className="text-xs text-muted-foreground">Permite que membros enviem sugestões em um canal específico.</div>
            </div>

            <Switch checked={Boolean(config?.enabled)} onCheckedChange={(checked) => config && set_config({ ...config, enabled: checked })} disabled={is_loading} />
          </div>

          {is_loading || !config ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal de sugestões</div>
                <div className="mt-1 text-xs text-muted-foreground">Canal onde membros escrevem sugestões (obrigatório se ativado).</div>
                <div className="mt-2">
                  <Select value={config.channelId ?? ''} onValueChange={(v) => set_config({ ...config, channelId: v || null })}>
                    <option value="">Selecione um canal</option>
                    {text_channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {channel_label(ch)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Canal de logs (opcional)</div>
                <div className="mt-1 text-xs text-muted-foreground">Onde o bot envia logs de aceite/negação.</div>
                <div className="mt-2">
                  <Select value={config.logChannelId ?? ''} onValueChange={(v) => set_config({ ...config, logChannelId: v || null })}>
                    <option value="">Desativado</option>
                    {text_channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {channel_label(ch)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Sugestões</div>
              <div className="mt-1 text-xs text-muted-foreground">Lista de sugestões (pendentes/aceitas/negadas).</div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={status_filter} onValueChange={set_status_filter_safe}>
                <option value="pending">Pendentes</option>
                <option value="accepted">Aceitas</option>
                <option value="denied">Negadas</option>
                <option value="all">Todas</option>
              </Select>
            </div>
          </div>

          {suggestions_query.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : suggestions_query.isError ? (
            <ErrorState
              title="Erro ao carregar sugestões"
              description="Não foi possível buscar a lista de sugestões."
              actionLabel="Tentar novamente"
              onAction={() => suggestions_query.refetch()}
            />
          ) : all_suggestions.length === 0 ? (
            <EmptyState
              title="Nenhuma sugestão encontrada"
              description={status_filter === 'pending' ? 'Ainda não há sugestões pendentes.' : status_filter === 'all' ? 'Ainda não há sugestões.' : 'Ainda não há sugestões nesse status.'}
            />
          ) : (
            <div className="space-y-2">
              {all_suggestions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.content}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Autor: <span className="font-mono">{s.userId}</span> • Status: <span className="font-mono">{s.status}</span> • Votos: <span className="font-mono">👍 {s.upvotes} / 👎 {s.downvotes}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div>
                  </div>

                  {s.status !== 'pending' && (s.decidedAt || s.decidedByUserId || s.decisionNote) && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Decidido em: {s.decidedAt ? new Date(s.decidedAt).toLocaleString() : '—'}
                      {s.decidedByUserId ? ` • Por: ${s.decidedByUserId}` : ''}
                      {s.decisionNote ? ` • Nota: ${s.decisionNote}` : ''}
                    </div>
                  )}
                </div>
              ))}

              {suggestions_query.hasNextPage && (
                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={() => suggestions_query.fetchNextPage()} isLoading={suggestions_query.isFetchingNextPage}>
                    <span>Carregar mais</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Mais votadas</div>
              <div className="mt-1 text-xs text-muted-foreground">Sugestões com melhor score (👍 - 👎) no período selecionado.</div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={top_timeframe}
                onValueChange={(value) => {
                  if (value === '30d' || value === '60d' || value === '3m' || value === '6m') {
                    set_top_timeframe(value)
                  }
                }}
              >
                <option value="30d">Últimos 30 dias</option>
                <option value="60d">Últimos 60 dias</option>
                <option value="3m">Últimos 3 meses</option>
                <option value="6m">Últimos 6 meses</option>
              </Select>
            </div>
          </div>

          {top_suggestions_query.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : top_suggestions_query.isError ? (
            <ErrorState
              title="Erro ao carregar sugestões mais votadas"
              description="Não foi possível buscar as sugestões mais votadas do período."
              actionLabel="Tentar novamente"
              onAction={() => top_suggestions_query.refetch()}
            />
          ) : (top_suggestions_query.data?.suggestions ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma sugestão encontrada"
              description={`Não há sugestões no período: ${suggestion_timeframe_label(top_timeframe)}.`}
            />
          ) : (
            <div className="space-y-2">
              {(top_suggestions_query.data?.suggestions ?? []).map((s) => {
                const score = s.upvotes - s.downvotes

                return (
                  <div key={s.id} className="rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{s.content}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Score: <span className="font-mono">{score}</span> • Votos:{' '}
                          <span className="font-mono">👍 {s.upvotes} / 👎 {s.downvotes}</span> • ID:{' '}
                          <span className="font-mono">{s.id}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
