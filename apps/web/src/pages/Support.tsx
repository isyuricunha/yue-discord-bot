import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios, { AxiosError } from 'axios'
import { ExternalLink, Heart, Plus, RefreshCw, Save, Trash2, Unplug } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, EmptyState, ErrorState, Input, Select, Skeleton, Switch, Textarea } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type api_role = {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
}

type support_config = {
  enabled: boolean
  title: string
  description: string
  reminderEnabled: boolean
  reminderDaysBefore: number
}

type livepix_connection = {
  id: string
  mode: 'OAUTH' | 'OWNER'
  status: 'CONNECTED' | 'REAUTH_REQUIRED' | 'DISCONNECTED' | 'ERROR'
  providerAccountId: string
  providerAccountUsername: string | null
  providerAccountDisplayName: string | null
  providerAccountAvatar: string | null
  providerWebhookId: string | null
  connectedAt: string
  tokenExpiresAt: string | null
  reconnectRequired: boolean
}

type support_plan = {
  id: string
  name: string
  description: string
  amountCents: number
  durationDays: number
  roleId: string
  enabled: boolean
  sortOrder: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

type support_payment = {
  id: string
  publicId: string
  userId: string
  planId: string | null
  providerAccountId: string
  livePixPaymentId: string | null
  planNameSnapshot: string
  amountCentsSnapshot: number
  durationDaysSnapshot: number
  roleIdSnapshot: string
  currency: string
  status: string
  roleSyncStatus: string
  confirmedAt: string | null
  fulfilledAt: string | null
  createdAt: string
  updatedAt: string
}

type support_entitlement = {
  id: string
  userId: string
  roleId: string
  latestPlanId: string | null
  status: string
  startsAt: string
  expiresAt: string
  roleSyncStatus: string
  revokedAt: string | null
  revokedReason: string | null
}

type support_overview = {
  success: boolean
  config: support_config
  connection: livepix_connection | null
  plans: support_plan[]
  ownerModeAllowed: boolean
  livePixEnabled: boolean
  roleWarnings: Array<{ roleId: string; reason: string }>
}

type plan_draft = {
  name: string
  description: string
  amountBrl: string
  durationDays: string
  roleId: string
  enabled: boolean
}

const empty_plan: plan_draft = {
  name: '',
  description: '',
  amountBrl: '',
  durationDays: '30',
  roleId: '',
  enabled: true,
}

function api_error_message(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: unknown } | undefined
    return typeof data?.error === 'string' ? data.error : error.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}

function format_money(amount_cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount_cents / 100)
}

function cents_to_brl_input(amount_cents: number) {
  return (amount_cents / 100).toFixed(2).replace('.', ',')
}

function brl_to_cents(input: string) {
  const normalized = input.trim().replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [reais, cents = ''] = normalized.split('.')
  const value = Number.parseInt(reais, 10) * 100 + Number.parseInt(cents.padEnd(2, '0'), 10)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function status_variant(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'CONNECTED' || status === 'FULFILLED' || status === 'ACTIVE' || status === 'SYNCED') return 'success'
  if (status === 'PENDING' || status === 'CONFIRMED' || status === 'REAUTH_REQUIRED') return 'warning'
  if (status === 'FAILED' || status === 'MISMATCH' || status === 'ERROR') return 'danger'
  if (status === 'EXPIRED' || status === 'REVOKED') return 'neutral'
  return 'info'
}

function role_label(role: api_role | undefined, fallback: string) {
  return role ? role.name : `...${fallback.slice(-6)}`
}

export default function SupportPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()
  const initialized = useRef(false)

  const [config, set_config] = useState<support_config | null>(null)
  const [draft, set_draft] = useState<plan_draft>(empty_plan)
  const [editing_plan_id, set_editing_plan_id] = useState<string | null>(null)
  const [payment_status, set_payment_status] = useState('')
  const [entitlement_status, set_entitlement_status] = useState('ACTIVE')

  const overview_query = useQuery({
    queryKey: ['support-overview', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/support`)
      return res.data as support_overview
    },
  })

  const roles_query = useQuery({
    queryKey: ['roles', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/roles`)
      return res.data as { success: boolean; roles: api_role[] }
    },
  })

  const payments_query = useQuery({
    queryKey: ['support-payments', guildId, payment_status],
    queryFn: async () => {
      const params = payment_status ? { status: payment_status } : undefined
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/support/payments`, { params })
      return res.data as { success: boolean; payments: support_payment[] }
    },
  })

  const entitlements_query = useQuery({
    queryKey: ['support-entitlements', guildId, entitlement_status],
    queryFn: async () => {
      const params = entitlement_status ? { status: entitlement_status } : undefined
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/support/entitlements`, { params })
      return res.data as { success: boolean; entitlements: support_entitlement[] }
    },
  })

  useEffect(() => {
    if (!overview_query.data?.config || initialized.current) return
    initialized.current = true
    set_config(overview_query.data.config)
  }, [overview_query.data])

  const roles = useMemo(() => roles_query.data?.roles ?? [], [roles_query.data])
  const role_by_id = useMemo(() => new Map(roles.map((role) => [role.id, role] as const)), [roles])
  const active_plans = overview_query.data?.plans.filter((plan) => !plan.archivedAt) ?? []

  const refresh_all = () => {
    overview_query.refetch()
    payments_query.refetch()
    entitlements_query.refetch()
    roles_query.refetch()
  }

  const save_config = useMutation({
    mutationFn: async (payload: support_config) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/support/config`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-overview', guildId] })
      toast_success('Configurações salvas.')
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao salvar configurações')),
  })

  const oauth_start = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`${API_URL}/api/guilds/${guildId}/support/livepix/oauth/start`)
      return res.data as { success: boolean; authorizationUrl: string }
    },
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao iniciar conexão LivePix')),
  })

  const owner_connect = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/support/livepix/owner/connect`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-overview', guildId] })
      toast_success('Conta LivePix conectada.')
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao conectar LivePix')),
  })

  const disconnect = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/support/livepix/disconnect`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-overview', guildId] })
      toast_success('Conta LivePix desconectada.')
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao desconectar LivePix')),
  })

  const save_plan = useMutation({
    mutationFn: async () => {
      const amountCents = brl_to_cents(draft.amountBrl)
      if (!amountCents) throw new Error('Valor inválido.')
      const durationDays = Number.parseInt(draft.durationDays, 10)
      if (!Number.isInteger(durationDays) || durationDays <= 0) throw new Error('Duração inválida.')
      if (!draft.roleId) throw new Error('Selecione um cargo.')

      const payload = {
        name: draft.name,
        description: draft.description,
        amountCents,
        durationDays,
        roleId: draft.roleId,
        enabled: draft.enabled,
      }

      if (editing_plan_id) {
        await axios.put(`${API_URL}/api/guilds/${guildId}/support/plans/${editing_plan_id}`, payload)
      } else {
        await axios.post(`${API_URL}/api/guilds/${guildId}/support/plans`, payload)
      }
    },
    onSuccess: () => {
      set_draft(empty_plan)
      set_editing_plan_id(null)
      queryClient.invalidateQueries({ queryKey: ['support-overview', guildId] })
      toast_success('Plano salvo.')
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao salvar plano')),
  })

  const update_plan = useMutation({
    mutationFn: async (input: { planId: string; payload: Partial<support_plan> & { archived?: boolean } }) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/support/plans/${input.planId}`, input.payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-overview', guildId] })
      toast_success('Plano atualizado.')
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao atualizar plano')),
  })

  const reorder_plans = useMutation({
    mutationFn: async (planIds: string[]) => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/support/plans/reorder`, { planIds })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support-overview', guildId] }),
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao reordenar planos')),
  })

  const revoke_entitlement = useMutation({
    mutationFn: async (entitlementId: string) => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/support/entitlements/${entitlementId}/revoke`, {
        reason: 'Revoked from dashboard',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-entitlements', guildId] })
      toast_success('Apoio revogado.')
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao revogar apoio')),
  })

  const retry_entitlement = useMutation({
    mutationFn: async (entitlementId: string) => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/support/entitlements/${entitlementId}/retry-role-sync`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-entitlements', guildId] })
      queryClient.invalidateQueries({ queryKey: ['support-payments', guildId] })
      toast_success('Sincronização solicitada.')
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao sincronizar cargo')),
  })

  const retry_payment = useMutation({
    mutationFn: async (paymentPublicId: string) => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/support/payments/${paymentPublicId}/retry-role-sync`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-payments', guildId] })
      queryClient.invalidateQueries({ queryKey: ['support-entitlements', guildId] })
      toast_success('Verificação solicitada.')
    },
    onError: (error: unknown) => toast_error(api_error_message(error, 'Erro ao verificar pagamento')),
  })

  const start_editing = (plan: support_plan) => {
    set_editing_plan_id(plan.id)
    set_draft({
      name: plan.name,
      description: plan.description,
      amountBrl: cents_to_brl_input(plan.amountCents),
      durationDays: String(plan.durationDays),
      roleId: plan.roleId,
      enabled: plan.enabled,
    })
  }

  if (overview_query.isLoading || !config) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (overview_query.isError) {
    return (
      <ErrorState
        title="Erro ao carregar Apoios"
        description="Não foi possível carregar a configuração de Apoios."
        actionLabel="Tentar novamente"
        onAction={() => refresh_all()}
      />
    )
  }

  const connection = overview_query.data?.connection ?? null

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <Heart className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Apoios</div>
            <div className="text-sm text-muted-foreground">Planos, pagamentos LivePix e cargos temporários do servidor</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" onClick={refresh_all}>
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </Button>
          <Button type="button" onClick={() => save_config.mutate(config)} isLoading={save_config.isPending}>
            <Save className="h-4 w-4" />
            <span>Salvar</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold">Módulo</div>
              <div className="mt-1 text-xs text-muted-foreground">Apoios ficam desativados até que você habilite o módulo.</div>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(enabled) => set_config({ ...config, enabled })} label="Apoios habilitado" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Título no Discord</div>
              <Input value={config.title} onChange={(event) => set_config({ ...config, title: event.target.value })} maxLength={100} className="mt-2" />
            </div>
            <div>
              <div className="text-sm font-medium">Lembrete antes de expirar</div>
              <div className="mt-2 flex items-center gap-3">
                <Switch
                  checked={config.reminderEnabled}
                  onCheckedChange={(reminderEnabled) => set_config({ ...config, reminderEnabled })}
                  label="Lembretes habilitados"
                />
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={config.reminderDaysBefore}
                  onChange={(event) => set_config({ ...config, reminderDaysBefore: Number.parseInt(event.target.value, 10) || 1 })}
                  className="w-24"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium">Descrição no Discord</div>
            <Textarea value={config.description} onChange={(event) => set_config({ ...config, description: event.target.value })} maxLength={1200} className="mt-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">LivePix</div>
              <div className="mt-1 text-xs text-muted-foreground">Credenciais nunca são exibidas nem enviadas ao navegador.</div>
            </div>
            <Badge variant={status_variant(connection?.status ?? 'DISCONNECTED')}>
              {connection?.status ?? 'DISCONNECTED'}
            </Badge>
          </div>

          {!overview_query.data?.livePixEnabled && (
            <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-muted-foreground">
              LivePix não está habilitado nesta instalação.
            </div>
          )}

          {connection ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-surface/30 p-4">
                <div className="text-xs text-muted-foreground">Conta</div>
                <div className="mt-1 text-sm font-semibold">{connection.providerAccountDisplayName ?? connection.providerAccountUsername ?? connection.providerAccountId}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/30 p-4">
                <div className="text-xs text-muted-foreground">Modo</div>
                <div className="mt-1 text-sm font-semibold">{connection.mode === 'OWNER' ? 'Conta da instalação' : 'OAuth do servidor'}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/30 p-4">
                <div className="text-xs text-muted-foreground">Conectado em</div>
                <div className="mt-1 text-sm font-semibold">{new Date(connection.connectedAt).toLocaleString('pt-BR')}</div>
              </div>
            </div>
          ) : (
            <EmptyState title="Nenhuma conta conectada" description="Conecte uma conta LivePix antes de habilitar checkouts." />
          )}

          {connection?.reconnectRequired && (
            <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-muted-foreground">
              A conexão precisa ser refeita porque o token expirou e a LivePix não documenta um fluxo de refresh seguro para este caso.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => oauth_start.mutate()} isLoading={oauth_start.isPending} disabled={!overview_query.data?.livePixEnabled}>
              <ExternalLink className="h-4 w-4" />
              <span>{connection?.reconnectRequired ? 'Reconectar LivePix' : 'Conectar LivePix'}</span>
            </Button>
            {overview_query.data?.ownerModeAllowed && (
              <Button type="button" variant="outline" onClick={() => owner_connect.mutate()} isLoading={owner_connect.isPending} disabled={!overview_query.data?.livePixEnabled}>
                <span>Usar conta da instalação</span>
              </Button>
            )}
            {connection && (
              <Button type="button" variant="ghost" onClick={() => disconnect.mutate()} isLoading={disconnect.isPending}>
                <Unplug className="h-4 w-4" />
                <span>Desconectar</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {overview_query.data?.roleWarnings.length ? (
        <Card className="border-accent/25">
          <CardContent className="space-y-2 p-6">
            <div className="text-sm font-semibold">Atenção aos cargos</div>
            {overview_query.data.roleWarnings.map((warning) => (
              <div key={warning.roleId} className="text-sm text-muted-foreground">
                {role_label(role_by_id.get(warning.roleId), warning.roleId)}: {warning.reason}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <div className="text-sm font-semibold">{editing_plan_id ? 'Editar plano' : 'Novo plano'}</div>
            <div className="mt-1 text-xs text-muted-foreground">O valor é salvo em centavos; a duração controla o tempo do cargo.</div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input placeholder="Nome" value={draft.name} onChange={(event) => set_draft({ ...draft, name: event.target.value })} maxLength={80} />
            <Select value={draft.roleId} onValueChange={(roleId) => set_draft({ ...draft, roleId })}>
              <option value="">Selecione um cargo</option>
              {roles.filter((role) => !role.managed).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Valor em BRL, ex: 10,00" value={draft.amountBrl} onChange={(event) => set_draft({ ...draft, amountBrl: event.target.value })} />
            <Input placeholder="Duração em dias" type="number" min={1} value={draft.durationDays} onChange={(event) => set_draft({ ...draft, durationDays: event.target.value })} />
          </div>

          <Textarea placeholder="Descrição" value={draft.description} onChange={(event) => set_draft({ ...draft, description: event.target.value })} maxLength={1000} />

          <div className="flex flex-wrap items-center gap-3">
            <Switch checked={draft.enabled} onCheckedChange={(enabled) => set_draft({ ...draft, enabled })} label="Plano habilitado" />
            <Button type="button" onClick={() => save_plan.mutate()} isLoading={save_plan.isPending}>
              <Plus className="h-4 w-4" />
              <span>{editing_plan_id ? 'Salvar plano' : 'Criar plano'}</span>
            </Button>
            {editing_plan_id && (
              <Button type="button" variant="ghost" onClick={() => { set_editing_plan_id(null); set_draft(empty_plan) }}>
                <span>Cancelar edição</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Planos</div>
              <div className="mt-1 text-xs text-muted-foreground">Até 25 planos ativos aparecem no menu do Discord.</div>
            </div>
            <Badge variant="neutral">{active_plans.filter((plan) => plan.enabled).length}/25 ativos</Badge>
          </div>

          {active_plans.length === 0 ? (
            <EmptyState title="Nenhum plano" description="Crie o primeiro plano para liberar o comando /apoiar." />
          ) : (
            <div className="space-y-2">
              {active_plans.map((plan, index) => (
                <div key={plan.id} className="rounded-xl border border-border/70 bg-surface/30 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{plan.name}</div>
                        <Badge variant={plan.enabled ? 'success' : 'neutral'}>{plan.enabled ? 'Ativo' : 'Desativado'}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {format_money(plan.amountCents)} • {plan.durationDays} dia(s) • {role_label(role_by_id.get(plan.roleId), plan.roleId)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => start_editing(plan)}>
                        <span>Editar</span>
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => update_plan.mutate({ planId: plan.id, payload: { enabled: !plan.enabled } })}>
                        <span>{plan.enabled ? 'Desativar' : 'Ativar'}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => {
                          const ids = active_plans.map((item) => item.id)
                          ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
                          reorder_plans.mutate(ids)
                        }}
                      >
                        <span>Subir</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={index === active_plans.length - 1}
                        onClick={() => {
                          const ids = active_plans.map((item) => item.id)
                          ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
                          reorder_plans.mutate(ids)
                        }}
                      >
                        <span>Descer</span>
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => update_plan.mutate({ planId: plan.id, payload: { archived: true } })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold">Pagamentos recentes</div>
                <div className="mt-1 text-xs text-muted-foreground">A listagem não expõe links de checkout.</div>
              </div>
              <Select value={payment_status} onValueChange={set_payment_status}>
                <option value="">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="FULFILLED">Cumpridos</option>
                <option value="MISMATCH">Divergentes</option>
                <option value="FAILED">Falhos</option>
              </Select>
            </div>

            {payments_query.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : payments_query.data?.payments.length ? (
              <div className="space-y-2">
                {payments_query.data.payments.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-border/70 bg-surface/30 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{payment.planNameSnapshot}</span>
                          <Badge variant={status_variant(payment.status)}>{payment.status}</Badge>
                          <Badge variant={status_variant(payment.roleSyncStatus)}>{payment.roleSyncStatus}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {format_money(payment.amountCentsSnapshot)} • usuário ...{payment.userId.slice(-6)} • {new Date(payment.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => retry_payment.mutate(payment.publicId)}>
                        <span>Verificar</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum pagamento" description="Ainda não há tentativas de pagamento neste servidor." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold">Apoios ativos e expirados</div>
                <div className="mt-1 text-xs text-muted-foreground">Revogar remove o cargo sem apagar histórico de pagamento.</div>
              </div>
              <Select value={entitlement_status} onValueChange={set_entitlement_status}>
                <option value="ACTIVE">Ativos</option>
                <option value="EXPIRED">Expirados</option>
                <option value="REVOKED">Revogados</option>
                <option value="">Todos</option>
              </Select>
            </div>

            {entitlements_query.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : entitlements_query.data?.entitlements.length ? (
              <div className="space-y-2">
                {entitlements_query.data.entitlements.map((entitlement) => (
                  <div key={entitlement.id} className="rounded-xl border border-border/70 bg-surface/30 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{role_label(role_by_id.get(entitlement.roleId), entitlement.roleId)}</span>
                          <Badge variant={status_variant(entitlement.status)}>{entitlement.status}</Badge>
                          <Badge variant={status_variant(entitlement.roleSyncStatus)}>{entitlement.roleSyncStatus}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          usuário ...{entitlement.userId.slice(-6)} • expira {new Date(entitlement.expiresAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => retry_entitlement.mutate(entitlement.id)}>
                          <span>Sincronizar</span>
                        </Button>
                        {entitlement.status === 'ACTIVE' && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => revoke_entitlement.mutate(entitlement.id)}>
                            <span>Revogar</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum apoio" description="Nenhum apoio encontrado para o filtro selecionado." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
