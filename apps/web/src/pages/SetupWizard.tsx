import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Check, LifeBuoy, Wand2 } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Select, Skeleton, Switch } from '../components/ui'
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

const CHANNEL_TYPE_GUILD_TEXT = 0
const CHANNEL_TYPE_GUILD_ANNOUNCEMENT = 5
const CHANNEL_TYPE_GUILD_CATEGORY = 4

function channel_label(ch: api_channel) {
  return `#${ch.name}`
}

export default function SetupWizardPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(1)
  const total_steps = 2

  const has_initialized = useRef(false)

  const {
    data: channels_data,
    isLoading: is_channels_loading,
    isError: is_channels_error,
    refetch: refetch_channels,
  } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return res.data as { channels: api_channel[] }
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
      return res.data as { roles: api_role[] }
    },
  })

  const {
    data: ticket_config_data,
    isError: is_ticket_config_error,
    refetch: refetch_ticket_config,
  } = useQuery({
    queryKey: ['ticket-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/ticket-config`)
      return res.data as { success: boolean; config: ticket_config }
    },
  })

  const channels = useMemo(() => {
    const list = channels_data?.channels ?? []
    return list.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [channels_data])

  const roles = useMemo(() => {
    const list = roles_data?.roles ?? []
    return list
      .slice()
      .filter((r) => !r.managed)
      .sort((a, b) => b.position - a.position)
  }, [roles_data])

  const role_by_id = useMemo(() => {
    const map = new Map<string, api_role>()
    for (const r of roles) map.set(r.id, r)
    return map
  }, [roles])

  const categories = useMemo(() => channels.filter((c) => c.type === CHANNEL_TYPE_GUILD_CATEGORY), [channels])

  const text_channels = useMemo(
    () => channels.filter((c) => c.type === CHANNEL_TYPE_GUILD_TEXT || c.type === CHANNEL_TYPE_GUILD_ANNOUNCEMENT),
    [channels]
  )

  const [tickets_enabled, set_tickets_enabled] = useState(false)
  const [ticket_panel_channel_id, set_ticket_panel_channel_id] = useState('')
  const [ticket_category_id, set_ticket_category_id] = useState('')
  const [ticket_log_channel_id, set_ticket_log_channel_id] = useState('')
  const [support_role_ids, set_support_role_ids] = useState<string[]>([])
  const [new_support_role_id, set_new_support_role_id] = useState('')

  const [published_message_id, set_published_message_id] = useState<string | null>(null)

  useEffect(() => {
    if (!ticket_config_data?.config) return
    if (has_initialized.current) return
    has_initialized.current = true

    const cfg = ticket_config_data.config

    set_tickets_enabled(Boolean(cfg.enabled))
    set_ticket_panel_channel_id(cfg.panelChannelId ?? '')
    set_ticket_category_id(cfg.categoryId ?? '')
    set_ticket_log_channel_id(cfg.logChannelId ?? '')
    set_support_role_ids(cfg.supportRoleIds ?? [])
  }, [ticket_config_data])

  const add_support_role = () => {
    const id = new_support_role_id
    if (!id) return
    if (support_role_ids.includes(id)) return
    if (support_role_ids.length >= 20) return

    set_support_role_ids((prev) => prev.concat(id))
    set_new_support_role_id('')
  }

  const remove_support_role = (id: string) => {
    set_support_role_ids((prev) => prev.filter((r) => r !== id))
  }

  const publish_and_save_mutation = useMutation({
    mutationFn: async () => {
      if (!guildId) throw new Error('Missing guildId')

      if (tickets_enabled) {
        if (!ticket_panel_channel_id) {
          throw new Error('Selecione um canal para o painel de tickets')
        }

        const publish_res = await axios.post(`${API_URL}/api/guilds/${guildId}/tickets/panel`, {
          channelId: ticket_panel_channel_id,
        })

        const message_id = String(publish_res.data?.messageId ?? '')
        if (!message_id) {
          throw new Error('Falha ao publicar o painel de tickets')
        }

        set_published_message_id(message_id)
      }

      await axios.put(`${API_URL}/api/guilds/${guildId}/ticket-config`, {
        enabled: tickets_enabled,
        categoryId: ticket_category_id || null,
        logChannelId: ticket_log_channel_id || null,
        supportRoleIds: support_role_ids,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ticket-config', guildId] })
      toast_success('Tickets configurados com sucesso!')
      setStep(2)
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Erro ao configurar tickets'
      toast_error(message)
    },
  })

  const can_proceed_step_1 = () => {
    if (!tickets_enabled) return true
    return Boolean(ticket_panel_channel_id)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/guild/${guildId}`)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div>
            <div className="text-xl font-semibold tracking-tight">Setup Wizard</div>
            <div className="text-sm text-muted-foreground">Configuração guiada da guild</div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Passo {step} de {total_steps}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Progresso</div>
            <div className="text-sm text-muted-foreground">{Math.round((step / total_steps) * 100)}%</div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-surface/70">
            <div
              className="h-2 rounded-full bg-accent transition-all duration-300"
              style={{ width: `${(step / total_steps) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {(is_channels_error || is_roles_error || is_ticket_config_error) && (
        <ErrorState
          title="Falha ao carregar dados"
          description="Não foi possível carregar canais/cargos/configuração da guild."
          onAction={() => {
            void refetch_channels()
            void refetch_roles()
            void refetch_ticket_config()
          }}
        />
      )}

      {step === 1 && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold">Tickets</div>
                <div className="text-xs text-muted-foreground">Configure suporte com painel e roles</div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
              <div>
                <div className="text-sm font-medium">Ativar tickets</div>
                <div className="mt-1 text-xs text-muted-foreground">Habilita criação de canais de atendimento</div>
              </div>
              <Switch checked={tickets_enabled} onCheckedChange={set_tickets_enabled} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal do painel (obrigatório se ativado)</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={ticket_panel_channel_id} onValueChange={set_ticket_panel_channel_id}>
                      <option value="">Selecione um canal</option>
                      {text_channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channel_label(ch)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Categoria (opcional)</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={ticket_category_id} onValueChange={set_ticket_category_id}>
                      <option value="">Sem categoria</option>
                      {categories.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Canal de logs (opcional)</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={ticket_log_channel_id} onValueChange={set_ticket_log_channel_id}>
                      <option value="">Sem logs</option>
                      {text_channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channel_label(ch)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Cargos de suporte (opcional)</div>
                <div className="mt-2 flex items-center gap-2">
                  {is_roles_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <>
                      <Select value={new_support_role_id} onValueChange={set_new_support_role_id}>
                        <option value="">Selecione um cargo</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </Select>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={add_support_role}
                        disabled={!new_support_role_id || support_role_ids.length >= 20}
                        className="shrink-0"
                      >
                        <span>Adicionar</span>
                      </Button>
                    </>
                  )}
                </div>

                {support_role_ids.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {support_role_ids.map((id) => {
                      const role = role_by_id.get(id)
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{role?.name ?? id}</div>
                            <div className="mt-1 text-xs text-muted-foreground font-mono">{id}</div>
                          </div>

                          <Button type="button" variant="ghost" size="sm" onClick={() => remove_support_role(id)} className="shrink-0">
                            Remover
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/80 pt-6">
              <div className="text-xs text-muted-foreground">Esse passo publica o painel e salva a configuração.</div>

              <Button
                onClick={() => publish_and_save_mutation.mutate()}
                isLoading={publish_and_save_mutation.isPending}
                disabled={!can_proceed_step_1()}
              >
                <Check className="h-4 w-4" />
                Concluir tickets
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Wand2 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold">Tickets configurados</div>
                <div className="text-xs text-muted-foreground">Pronto. Você pode ajustar detalhes depois.</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-surface/30 p-4 text-sm">
              <div>Status: {tickets_enabled ? 'Ativo' : 'Desativado'}</div>
              <div className="mt-1">Painel: {ticket_panel_channel_id ? <span className="font-mono">{ticket_panel_channel_id}</span> : '—'}</div>
              <div className="mt-1">Mensagem publicada: {published_message_id ? <span className="font-mono">{published_message_id}</span> : '—'}</div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(`/guild/${guildId}`)}>
                Voltar ao dashboard
              </Button>
              <Button onClick={() => navigate(`/guild/${guildId}/tickets`)}>Ir para Tickets</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
