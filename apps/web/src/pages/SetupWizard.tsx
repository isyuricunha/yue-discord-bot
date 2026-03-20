import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Check, LifeBuoy, Mail, Shield, Sparkles, UserPlus, Wand2 } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Input, Select, Skeleton, Switch, Textarea } from '../components/ui'
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

type welcome_config_response = {
  success: boolean
  config: {
    welcomeChannelId: string | null
    leaveChannelId: string | null
    welcomeMessage: string | null
    leaveMessage: string | null
  }
}

type modlog_config_response = {
  success: boolean
  config: {
    modLogChannelId: string | null
    modLogMessage: string | null
  }
}

type automod_config_response = {
  success: boolean
  config: {
    linkFilterEnabled: boolean
    linkBlockAll: boolean
    linkAction: string
  }
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
  const total_steps = 6

  const has_initialized_tickets = useRef(false)
  const has_initialized_welcome = useRef(false)
  const has_initialized_modlog = useRef(false)
  const has_initialized_automod = useRef(false)
  const has_initialized_autorole = useRef(false)
  const has_initialized_xp = useRef(false)

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

  const save_welcome_mutation = useMutation({
    mutationFn: async () => {
      if (!guildId) throw new Error('Missing guildId')

      await axios.put(`${API_URL}/api/guilds/${guildId}/welcome-config`, {
        welcomeChannelId: welcome_channel_id || undefined,
        leaveChannelId: leave_channel_id || undefined,
        welcomeMessage: welcome_message ? welcome_message : null,
        leaveMessage: leave_message ? leave_message : null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['welcome-config', guildId] })
      toast_success('Boas-vindas configurado!')
      setStep(3)
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Erro ao salvar boas-vindas'
      toast_error(message)
    },
  })

  const save_autorole_mutation = useMutation({
    mutationFn: async () => {
      if (!guildId) throw new Error('Missing guildId')

      const delay = Math.max(0, Math.floor(autorole_delay_seconds))

      await axios.put(`${API_URL}/api/guilds/${guildId}/autorole-config`, {
        enabled: autorole_enabled,
        delaySeconds: delay,
        onlyAfterFirstMessage: autorole_only_after_first_message,
        roleIds: autorole_role_ids,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['autorole-config', guildId] })
      toast_success('Autorole configurado!')
      setStep(5)
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Erro ao salvar autorole'
      toast_error(message)
    },
  })

  const save_xp_mutation = useMutation({
    mutationFn: async () => {
      if (!guildId) throw new Error('Missing guildId')

      await axios.put(`${API_URL}/api/guilds/${guildId}/xp-config`, {
        enabled: xp_enabled,
        levelUpChannelId: xp_level_up_channel_id || null,
        levelUpMessage: xp_level_up_message ? xp_level_up_message : null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['xp-config', guildId] })
      toast_success('XP configurado!')
      setStep(6)
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Erro ao salvar XP'
      toast_error(message)
    },
  })

  const {
    data: welcome_config_data,
    isLoading: is_welcome_config_loading,
    isError: is_welcome_config_error,
    refetch: refetch_welcome_config,
  } = useQuery({
    queryKey: ['welcome-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/welcome-config`)
      return res.data as welcome_config_response
    },
  })

  const {
    data: modlog_config_data,
    isError: is_modlog_config_error,
    refetch: refetch_modlog_config,
  } = useQuery({
    queryKey: ['modlog-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/modlog-config`)
      return res.data as modlog_config_response
    },
  })

  const {
    data: automod_config_data,
    isError: is_automod_config_error,
    refetch: refetch_automod_config,
  } = useQuery({
    queryKey: ['automod-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/automod-config`)
      return res.data as automod_config_response
    },
  })

  const {
    data: autorole_data,
    isError: is_autorole_error,
    refetch: refetch_autorole,
  } = useQuery({
    queryKey: ['autorole-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/autorole-config`)
      return res.data as {
        success: boolean
        config: { enabled: boolean; delaySeconds: number; onlyAfterFirstMessage: boolean }
        roleIds: string[]
      }
    },
  })

  const {
    data: xp_data,
    isError: is_xp_error,
    refetch: refetch_xp,
  } = useQuery({
    queryKey: ['xp-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/xp-config`)
      return res.data as { success: boolean; config: any; rewards: any[] }
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

  const [welcome_channel_id, set_welcome_channel_id] = useState('')
  const [leave_channel_id, set_leave_channel_id] = useState('')
  const [welcome_message, set_welcome_message] = useState('')
  const [leave_message, set_leave_message] = useState('')

  const [automod_modlog_channel_id, set_automod_modlog_channel_id] = useState('')
  const [automod_link_enabled, set_automod_link_enabled] = useState(false)
  const [automod_link_block_all, set_automod_link_block_all] = useState(false)
  const [automod_link_action, set_automod_link_action] = useState('delete')

  const [autorole_enabled, set_autorole_enabled] = useState(false)
  const [autorole_delay_seconds, set_autorole_delay_seconds] = useState(0)
  const [autorole_only_after_first_message, set_autorole_only_after_first_message] = useState(false)
  const [autorole_role_ids, set_autorole_role_ids] = useState<string[]>([])
  const [new_autorole_role_id, set_new_autorole_role_id] = useState('')

  const [xp_enabled, set_xp_enabled] = useState(false)
  const [xp_level_up_channel_id, set_xp_level_up_channel_id] = useState('')
  const [xp_level_up_message, set_xp_level_up_message] = useState('')

  useEffect(() => {
    if (!ticket_config_data?.config) return
    if (has_initialized_tickets.current) return
    has_initialized_tickets.current = true

    const cfg = ticket_config_data.config

    set_tickets_enabled(Boolean(cfg.enabled))
    set_ticket_panel_channel_id(cfg.panelChannelId ?? '')
    set_ticket_category_id(cfg.categoryId ?? '')
    set_ticket_log_channel_id(cfg.logChannelId ?? '')
    set_support_role_ids(cfg.supportRoleIds ?? [])
  }, [ticket_config_data])

  useEffect(() => {
    const cfg = welcome_config_data?.config
    if (!cfg) return
    if (has_initialized_welcome.current) return
    has_initialized_welcome.current = true

    set_welcome_channel_id(cfg.welcomeChannelId ?? '')
    set_leave_channel_id(cfg.leaveChannelId ?? '')
    set_welcome_message(cfg.welcomeMessage ?? '')
    set_leave_message(cfg.leaveMessage ?? '')
  }, [welcome_config_data])

  useEffect(() => {
    const cfg = modlog_config_data?.config
    if (!cfg) return
    if (has_initialized_modlog.current) return
    has_initialized_modlog.current = true

    set_automod_modlog_channel_id(cfg.modLogChannelId ?? '')
  }, [modlog_config_data])

  useEffect(() => {
    const cfg = automod_config_data?.config
    if (!cfg) return
    if (has_initialized_automod.current) return
    has_initialized_automod.current = true

    set_automod_link_enabled(Boolean(cfg.linkFilterEnabled))
    set_automod_link_block_all(Boolean(cfg.linkBlockAll))
    set_automod_link_action(cfg.linkAction ? String(cfg.linkAction) : 'delete')
  }, [automod_config_data])

  const save_automod_mutation = useMutation({
    mutationFn: async () => {
      if (!guildId) throw new Error('Missing guildId')

      await Promise.all([
        axios.put(`${API_URL}/api/guilds/${guildId}/modlog-config`, {
          modLogChannelId: automod_modlog_channel_id || null,
        }),
        axios.put(`${API_URL}/api/guilds/${guildId}/automod-config`, {
          linkFilterEnabled: automod_link_enabled,
          linkBlockAll: automod_link_block_all,
          linkAction: automod_link_action,
        }),
      ])
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['modlog-config', guildId] })
      await queryClient.invalidateQueries({ queryKey: ['automod-config', guildId] })
      toast_success('AutoMod configurado!')
      setStep(4)
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || 'Erro ao salvar AutoMod'
      toast_error(message)
    },
  })

  useEffect(() => {
    if (!autorole_data) return
    if (has_initialized_autorole.current) return
    has_initialized_autorole.current = true

    set_autorole_enabled(Boolean(autorole_data.config.enabled))
    set_autorole_delay_seconds(Number(autorole_data.config.delaySeconds ?? 0))
    set_autorole_only_after_first_message(Boolean(autorole_data.config.onlyAfterFirstMessage))
    set_autorole_role_ids(Array.isArray(autorole_data.roleIds) ? autorole_data.roleIds : [])
  }, [autorole_data])

  useEffect(() => {
    const cfg = xp_data?.config
    if (!cfg) return
    if (has_initialized_xp.current) return
    has_initialized_xp.current = true

    set_xp_enabled(Boolean(cfg.enabled))
    set_xp_level_up_channel_id(cfg.levelUpChannelId ?? '')
    set_xp_level_up_message(cfg.levelUpMessage ?? '')
  }, [xp_data])

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

  const add_autorole_role = () => {
    const id = new_autorole_role_id
    if (!id) return
    if (autorole_role_ids.includes(id)) return
    if (autorole_role_ids.length >= 20) return

    set_autorole_role_ids((prev) => prev.concat(id))
    set_new_autorole_role_id('')
  }

  const remove_autorole_role = (id: string) => {
    set_autorole_role_ids((prev) => prev.filter((r) => r !== id))
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

  const can_proceed_step_2 = () => {
    if (!welcome_channel_id && !leave_channel_id && !welcome_message && !leave_message) return true
    return true
  }

  const can_proceed_step_3 = () => {
    if (!automod_link_enabled) return true
    return Boolean(automod_link_action)
  }

  const can_proceed_step_4 = () => {
    if (!autorole_enabled) return true
    return autorole_role_ids.length > 0
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

      {(is_channels_error ||
        is_roles_error ||
        is_ticket_config_error ||
        is_welcome_config_error ||
        is_modlog_config_error ||
        is_automod_config_error ||
        is_autorole_error ||
        is_xp_error) && (
          <ErrorState
            title="Falha ao carregar dados"
            description="Não foi possível carregar dados/configurações da guild."
            onAction={() => {
              void refetch_channels()
              void refetch_roles()
              void refetch_ticket_config()
              void refetch_welcome_config()
              void refetch_modlog_config()
              void refetch_automod_config()
              void refetch_autorole()
              void refetch_xp()
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
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold">Boas-vindas</div>
                <div className="text-xs text-muted-foreground">Configure canais e mensagens automáticas</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal de boas-vindas</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={welcome_channel_id} onValueChange={set_welcome_channel_id}>
                      <option value="">Desativado</option>
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
                <div className="text-sm font-medium">Canal de saída</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={leave_channel_id} onValueChange={set_leave_channel_id}>
                      <option value="">Desativado</option>
                      {text_channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channel_label(ch)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-sm font-medium">Mensagem de boas-vindas (opcional)</div>
                <div className="mt-2">
                  {is_welcome_config_loading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <Textarea value={welcome_message} onChange={(e) => set_welcome_message(e.target.value)} rows={4} placeholder="Ex: Olá {@user}!" />
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Aceita placeholders (ex: {'{@user}'}).</div>
              </div>

              <div className="md:col-span-2">
                <div className="text-sm font-medium">Mensagem de saída (opcional)</div>
                <div className="mt-2">
                  {is_welcome_config_loading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <Textarea value={leave_message} onChange={(e) => set_leave_message(e.target.value)} rows={3} placeholder="Ex: {user} saiu do servidor." />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/80 pt-6">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>

              <Button onClick={() => save_welcome_mutation.mutate()} isLoading={save_welcome_mutation.isPending} disabled={!can_proceed_step_2()}>
                <Check className="h-4 w-4" />
                Concluir boas-vindas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold">AutoMod (básico)</div>
                <div className="text-xs text-muted-foreground">Logs e filtro de links</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal de mod logs (opcional)</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={automod_modlog_channel_id} onValueChange={set_automod_modlog_channel_id}>
                      <option value="">Desativado</option>
                      {text_channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channel_label(ch)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-surface/30 p-4">
                <div>
                  <div className="text-sm font-medium">Filtro de links</div>
                  <div className="mt-1 text-xs text-muted-foreground">Deleta mensagens com links e aplica a punição escolhida.</div>
                </div>
                <Switch checked={automod_link_enabled} onCheckedChange={set_automod_link_enabled} label="Links" />
              </div>

              {automod_link_enabled && (
                <>
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-surface/30 p-4">
                    <div>
                      <div className="text-sm font-medium">Bloquear todos os links</div>
                      <div className="mt-1 text-xs text-muted-foreground">Quando desativado, você pode permitir domínios na página de AutoMod.</div>
                    </div>
                    <Switch checked={automod_link_block_all} onCheckedChange={set_automod_link_block_all} label="Bloquear" />
                  </div>

                  <div>
                    <div className="text-sm font-medium">Ação</div>
                    <div className="mt-2">
                      <Select value={automod_link_action} onValueChange={set_automod_link_action}>
                        <option value="delete">Deletar</option>
                        <option value="warn">Avisar</option>
                        <option value="mute">Silenciar</option>
                        <option value="kick">Expulsar</option>
                        <option value="ban">Banir</option>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/80 pt-6">
              <Button variant="outline" onClick={() => setStep(2)}>
                Voltar
              </Button>

              <Button
                onClick={() => save_automod_mutation.mutate()}
                isLoading={save_automod_mutation.isPending}
                disabled={!can_proceed_step_3()}
              >
                <Check className="h-4 w-4" />
                Concluir AutoMod
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <UserPlus className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold">Autorole</div>
                <div className="text-xs text-muted-foreground">Cargos automáticos para novos membros</div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
              <div>
                <div className="text-sm font-medium">Ativar autorole</div>
                <div className="mt-1 text-xs text-muted-foreground">Aplica cargos automaticamente para novos membros</div>
              </div>
              <Switch checked={autorole_enabled} onCheckedChange={set_autorole_enabled} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Aguardar (segundos)</div>
                <div className="mt-2">
                  <Input
                    value={String(autorole_delay_seconds)}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value || '0', 10)
                      set_autorole_delay_seconds(Number.isNaN(parsed) ? 0 : Math.max(0, parsed))
                    }}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-surface/30 p-4">
                <div>
                  <div className="text-sm font-medium">Somente após primeira mensagem</div>
                  <div className="mt-1 text-xs text-muted-foreground">Recomendado em servidores com verificação alta.</div>
                </div>
                <Switch checked={autorole_only_after_first_message} onCheckedChange={set_autorole_only_after_first_message} label="Após mensagem" />
              </div>

              <div className="md:col-span-2">
                <div className="text-sm font-medium">Adicionar cargo (opcional)</div>
                <div className="mt-2 flex items-center gap-2">
                  {is_roles_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <>
                      <Select value={new_autorole_role_id} onValueChange={set_new_autorole_role_id}>
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
                        onClick={add_autorole_role}
                        disabled={!new_autorole_role_id || autorole_role_ids.length >= 20}
                        className="shrink-0"
                      >
                        <span>Adicionar</span>
                      </Button>
                    </>
                  )}
                </div>

                {autorole_role_ids.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {autorole_role_ids.map((id) => {
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

                          <Button type="button" variant="ghost" size="sm" onClick={() => remove_autorole_role(id)} className="shrink-0">
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
              <Button variant="outline" onClick={() => setStep(3)}>
                Voltar
              </Button>

              <Button
                onClick={() => save_autorole_mutation.mutate()}
                isLoading={save_autorole_mutation.isPending}
                disabled={!can_proceed_step_4()}
              >
                <Check className="h-4 w-4" />
                Concluir autorole
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold">XP</div>
                <div className="text-xs text-muted-foreground">Níveis e mensagem de level up</div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
              <div>
                <div className="text-sm font-medium">Ativar XP</div>
                <div className="mt-1 text-xs text-muted-foreground">Habilita ganho de XP e níveis</div>
              </div>
              <Switch checked={xp_enabled} onCheckedChange={set_xp_enabled} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal de level up (opcional)</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={xp_level_up_channel_id} onValueChange={set_xp_level_up_channel_id}>
                      <option value="">Desativado</option>
                      {text_channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channel_label(ch)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-sm font-medium">Mensagem de level up (opcional)</div>
                <div className="mt-2">
                  <Textarea
                    value={xp_level_up_message}
                    onChange={(e) => set_xp_level_up_message(e.target.value)}
                    rows={3}
                    placeholder="Ex: {@user} subiu para o nível {level}!"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/80 pt-6">
              <Button variant="outline" onClick={() => setStep(4)}>
                Voltar
              </Button>

              <Button onClick={() => save_xp_mutation.mutate()} isLoading={save_xp_mutation.isPending}>
                <Check className="h-4 w-4" />
                Concluir XP
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Wand2 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold">Setup concluído</div>
                <div className="text-xs text-muted-foreground">Você pode ajustar tudo depois nas páginas específicas.</div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-surface/30 p-4 text-sm">
              <div className="font-medium">Resumo</div>
              <div className="mt-2">Tickets: {tickets_enabled ? 'Ativo' : 'Desativado'}</div>
              <div className="mt-1">Painel: {ticket_panel_channel_id ? <span className="font-mono">{ticket_panel_channel_id}</span> : '—'}</div>
              <div className="mt-1">Mensagem do painel: {published_message_id ? <span className="font-mono">{published_message_id}</span> : '—'}</div>
              <div className="mt-2">Boas-vindas: {welcome_channel_id ? <span className="font-mono">{welcome_channel_id}</span> : '—'}</div>
              <div className="mt-1">AutoMod: {automod_link_enabled ? `Links ${automod_link_block_all ? '(block all)' : ''}` : 'Links off'}</div>
              <div className="mt-1">Autorole: {autorole_enabled ? `Ativo (${autorole_role_ids.length} cargos)` : 'Desativado'}</div>
              <div className="mt-1">XP: {xp_enabled ? 'Ativo' : 'Desativado'}</div>
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
