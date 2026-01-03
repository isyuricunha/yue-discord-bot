import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { LifeBuoy, Save, Trash2, RefreshCcw } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Select, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type api_channel = {
  id: string
  name: string
  type: number
}

type api_role = {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
}

type ticket_config = {
  enabled: boolean
  categoryId: string | null
  logChannelId: string | null
  supportRoleIds: string[]
  panelChannelId: string | null
  panelMessageId: string | null
}

type api_ticket = {
  id: string
  userId: string
  channelId: string
  status: 'open' | 'closed' | string
  createdAt: string
  closedAt: string | null
  closedByUserId: string | null
  closeReason: string | null
}

function channel_label(ch: api_channel) {
  return `#${ch.name}`
}

const CHANNEL_TYPE_GUILD_TEXT = 0
const CHANNEL_TYPE_GUILD_ANNOUNCEMENT = 5
const CHANNEL_TYPE_GUILD_CATEGORY = 4

export default function TicketsPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()
  const has_initialized = useRef(false)

  const [config, setConfig] = useState<ticket_config | null>(null)
  const [new_support_role_id, set_new_support_role_id] = useState('')

  const [status_filter, set_status_filter] = useState<'all' | 'open' | 'closed'>('open')

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
    data: roles_data,
    isLoading: is_roles_loading,
    isError: is_roles_error,
    refetch: refetch_roles,
  } = useQuery({
    queryKey: ['roles', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/roles`)
      return res.data as { success: boolean; roles: api_role[] }
    },
  })

  const {
    data: ticket_config_data,
    isLoading: is_ticket_config_loading,
    isError: is_ticket_config_error,
    refetch: refetch_ticket_config,
  } = useQuery({
    queryKey: ['ticket-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/ticket-config`)
      return res.data as { success: boolean; config: ticket_config }
    },
  })

  useEffect(() => {
    if (!ticket_config_data?.config) return
    if (has_initialized.current) return
    has_initialized.current = true

    setConfig({
      enabled: ticket_config_data.config.enabled ?? false,
      categoryId: ticket_config_data.config.categoryId ?? null,
      logChannelId: ticket_config_data.config.logChannelId ?? null,
      supportRoleIds: ticket_config_data.config.supportRoleIds ?? [],
      panelChannelId: ticket_config_data.config.panelChannelId ?? null,
      panelMessageId: ticket_config_data.config.panelMessageId ?? null,
    })
  }, [ticket_config_data])

  const save_mutation = useMutation({
    mutationFn: async (payload: Pick<ticket_config, 'enabled' | 'categoryId' | 'logChannelId' | 'supportRoleIds'>) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/ticket-config`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const tickets_query = useInfiniteQuery({
    queryKey: ['tickets', guildId, status_filter],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit: 25 }
      if (status_filter !== 'all') params.status = status_filter
      if (typeof pageParam === 'string' && pageParam) params.cursor = pageParam

      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/tickets`, { params })
      return res.data as { success: boolean; tickets: api_ticket[]; nextCursor: string | null }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const is_loading = is_channels_loading || is_roles_loading || is_ticket_config_loading
  const is_error = is_channels_error || is_roles_error || is_ticket_config_error

  const channels = useMemo(() => {
    const list = channels_data?.channels ?? []
    return list.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [channels_data])

  const category_channels = useMemo(
    () => channels.filter((c) => c.type === CHANNEL_TYPE_GUILD_CATEGORY),
    [channels]
  )

  const text_channels = useMemo(
    () => channels.filter((c) => c.type === CHANNEL_TYPE_GUILD_TEXT || c.type === CHANNEL_TYPE_GUILD_ANNOUNCEMENT),
    [channels]
  )

  const roles = roles_data?.roles ?? []
  const available_roles = roles
    .filter((r) => !r.managed)
    .slice()
    .sort((a, b) => b.position - a.position)

  const role_by_id = useMemo(() => new Map(available_roles.map((r) => [r.id, r] as const)), [available_roles])

  const handle_save = () => {
    if (!config) return
    save_mutation.mutate({
      enabled: config.enabled,
      categoryId: config.categoryId,
      logChannelId: config.logChannelId,
      supportRoleIds: config.supportRoleIds,
    })
  }

  const add_support_role = () => {
    if (!config) return
    if (!new_support_role_id) return
    if (config.supportRoleIds.includes(new_support_role_id)) return
    if (config.supportRoleIds.length >= 20) return

    setConfig({ ...config, supportRoleIds: [...config.supportRoleIds, new_support_role_id] })
    set_new_support_role_id('')
  }

  const remove_support_role = (role_id: string) => {
    if (!config) return
    setConfig({ ...config, supportRoleIds: config.supportRoleIds.filter((id) => id !== role_id) })
  }

  const all_tickets = useMemo(() => {
    const pages = tickets_query.data?.pages ?? []
    return pages.flatMap((p) => p.tickets ?? [])
  }, [tickets_query.data])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <LifeBuoy className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Tickets</div>
            <div className="text-sm text-muted-foreground">Configuração e lista de tickets do servidor</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => {
              refetch_channels()
              refetch_roles()
              refetch_ticket_config()
              tickets_query.refetch()
            }}
          >
            Atualizar
          </Button>

          <Button onClick={handle_save} isLoading={save_mutation.isPending} disabled={!config || is_loading} className="shrink-0">
            <Save className="h-4 w-4" />
            <span>Salvar</span>
          </Button>
        </div>
      </div>

      {is_error && (
        <ErrorState
          title="Erro ao carregar tickets"
          description="Não foi possível carregar canais/roles/configuração de tickets."
          actionLabel="Tentar novamente"
          onAction={() => {
            refetch_channels()
            refetch_roles()
            refetch_ticket_config()
          }}
        />
      )}

      <Card className="border-accent/20">
        <CardContent className="p-6 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Nota:</span> o painel (mensagem com botão “Abrir ticket”) é criado via{' '}
          <span className="font-mono text-foreground">/ticket setup</span> no Discord.
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Ativar tickets</div>
              <div className="text-xs text-muted-foreground">Permite que usuários abram tickets pelo painel.</div>
            </div>

            <Switch
              checked={Boolean(config?.enabled)}
              onCheckedChange={(checked) => config && setConfig({ ...config, enabled: checked })}
              label="Tickets habilitado"
              disabled={is_loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Categoria dos tickets</div>
              <div className="mt-1 text-xs text-muted-foreground">Onde os canais de ticket serão criados (opcional).</div>
              <div className="mt-2">
                {is_loading || !config ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select
                    value={config.categoryId ?? ''}
                    onValueChange={(value) => setConfig({ ...config, categoryId: value || null })}
                  >
                    <option value="">Sem categoria</option>
                    {category_channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {channel_label(c)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Canal de logs</div>
              <div className="mt-1 text-xs text-muted-foreground">Onde registrar abertura/fechamento de tickets (opcional).</div>
              <div className="mt-2">
                {is_loading || !config ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select value={config.logChannelId ?? ''} onValueChange={(value) => setConfig({ ...config, logChannelId: value || null })}>
                    <option value="">Sem logs</option>
                    {text_channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {channel_label(c)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Painel</div>
              <div className="mt-1 text-xs text-muted-foreground">Criado pelo bot via /ticket setup.</div>
              <div className="mt-2 rounded-2xl border border-border/70 bg-surface/30 p-4 text-sm">
                <div>
                  Canal: {config?.panelChannelId ? <span className="font-mono">{config.panelChannelId}</span> : '—'}
                </div>
                <div className="mt-1">
                  Mensagem: {config?.panelMessageId ? <span className="font-mono">{config.panelMessageId}</span> : '—'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Cargo(s) de suporte</div>
              <div className="mt-1 text-xs text-muted-foreground">Cargos com acesso aos canais de ticket (até 20).</div>

              {is_loading || !config ? (
                <Skeleton className="mt-2 h-24 w-full" />
              ) : (
                <div className="mt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <Select value={new_support_role_id} onValueChange={set_new_support_role_id}>
                      <option value="">Selecione um cargo</option>
                      {available_roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={add_support_role}
                      disabled={!new_support_role_id || config.supportRoleIds.length >= 20}
                      className="shrink-0"
                    >
                      <span>Adicionar</span>
                    </Button>
                  </div>

                  {config.supportRoleIds.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhum cargo configurado.</div>
                  ) : (
                    <div className="space-y-2">
                      {config.supportRoleIds.map((id) => {
                        const role = role_by_id.get(id)
                        return (
                          <div key={id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{role?.name ?? id}</div>
                              <div className="mt-1 text-xs text-muted-foreground font-mono">{id}</div>
                            </div>

                            <Button type="button" variant="ghost" size="sm" onClick={() => remove_support_role(id)} className="shrink-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Tickets</div>
              <div className="mt-1 text-xs text-muted-foreground">Lista de tickets (abertos/fechados).</div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={status_filter} onValueChange={(v) => set_status_filter(v as any)}>
                <option value="open">Abertos</option>
                <option value="closed">Fechados</option>
                <option value="all">Todos</option>
              </Select>
            </div>
          </div>

          {tickets_query.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : tickets_query.isError ? (
            <ErrorState
              title="Erro ao carregar tickets"
              description="Não foi possível buscar a lista de tickets."
              actionLabel="Tentar novamente"
              onAction={() => tickets_query.refetch()}
            />
          ) : all_tickets.length === 0 ? (
            <EmptyState
              title="Nenhum ticket encontrado"
              description={status_filter === 'closed' ? 'Ainda não há tickets fechados.' : status_filter === 'all' ? 'Ainda não há tickets.' : 'Ainda não há tickets abertos.'}
            />
          ) : (
            <div className="space-y-2">
              {all_tickets.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">#{t.channelId}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Usuário: <span className="font-mono">{t.userId}</span> • Status: <span className="font-mono">{t.status}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
                  </div>

                  {t.status === 'closed' && (t.closeReason || t.closedAt) && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Fechado em: {t.closedAt ? new Date(t.closedAt).toLocaleString() : '—'}
                      {t.closeReason ? ` • Motivo: ${t.closeReason}` : ''}
                    </div>
                  )}
                </div>
              ))}

              {tickets_query.hasNextPage && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => tickets_query.fetchNextPage()}
                    isLoading={tickets_query.isFetchingNextPage}
                  >
                    <span>Carregar mais</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
