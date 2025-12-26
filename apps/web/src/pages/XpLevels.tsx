import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Plus, Save, Sparkles, Trash2 } from 'lucide-react'

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

type xp_reward = {
  level: number
  roleId: string
}

type xp_config = {
  enabled: boolean

  minMessageLength: number
  minUniqueLength: number
  typingCps: number
  xpDivisorMin: number
  xpDivisorMax: number
  xpCap: number

  ignoredChannelIds: string[]
  ignoredRoleIds: string[]
  roleXpMultipliers: Record<string, number>

  rewardMode: 'stack' | 'highest'

  levelUpChannelId: string | null
  levelUpMessage: string | null
}

function channel_label(ch: api_channel) {
  return `#${ch.name}`
}

export default function XpLevelsPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const has_initialized = useRef(false)

  const { data: channels_data, isLoading: is_channels_loading } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return res.data as { channels: api_channel[] }
    },
  })

  const reset_user_mutation = useMutation({
    mutationFn: async (payload: { userId: string }) => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/xp-reset`, { scope: 'user', userId: payload.userId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xp-leaderboard', guildId] })
      queryClient.invalidateQueries({ queryKey: ['xp-me', guildId] })
      toast_success('XP do usuário zerado com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao zerar XP do usuário')
    },
  })

  const reset_global_mutation = useMutation({
    mutationFn: async (payload: { scope: 'global' | 'user'; userId?: string }) => {
      await axios.post(`${API_URL}/api/xp/global-reset`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xp-global-leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['xp-global-me'] })
      toast_success('XP global zerado com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao zerar XP global')
    },
  })

  const { data: global_leaderboard } = useQuery({
    queryKey: ['xp-global-leaderboard'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/xp/global-leaderboard?limit=10&offset=0`)
      return res.data as {
        leaderboard: Array<{ userId: string; username: string; avatar: string | null; xp: number; level: number; position: number }>
        total: number
      }
    },
  })

  const reset_mutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/xp-reset`, { scope: 'guild' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xp-leaderboard', guildId] })
      queryClient.invalidateQueries({ queryKey: ['xp-me', guildId] })
      toast_success('XP do servidor zerado com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao zerar XP')
    },
  })

  const { data: roles_data, isLoading: is_roles_loading } = useQuery({
    queryKey: ['roles', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/roles`)
      return res.data as { roles: api_role[] }
    },
  })

  const {
    data: xp_data,
    isLoading: is_xp_loading,
    isError: is_xp_error,
    refetch: refetch_xp,
  } = useQuery({
    queryKey: ['xp-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/xp-config`)
      return res.data as { config: xp_config; rewards: xp_reward[] }
    },
  })

  const { data: my_xp } = useQuery({
    queryKey: ['xp-me', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/xp-me`)
      return res.data as { xp: number; level: number; position: number | null }
    },
  })

  const { data: my_global_xp } = useQuery({
    queryKey: ['xp-global-me'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/xp/global-me`)
      return res.data as { xp: number; level: number; position: number | null }
    },
  })

  const { data: leaderboard } = useQuery({
    queryKey: ['xp-leaderboard', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/xp-leaderboard?limit=10&offset=0`)
      return res.data as {
        leaderboard: Array<{ userId: string; username: string; avatar: string | null; xp: number; level: number; position: number }>
        total: number
      }
    },
  })

  const role_by_id = useMemo(() => {
    const roles = roles_data?.roles ?? []
    return new Map(roles.map((r) => [r.id, r]))
  }, [roles_data])

  const channel_by_id = useMemo(() => {
    const channels = channels_data?.channels ?? []
    return new Map(channels.map((c) => [c.id, c]))
  }, [channels_data])

  const [config, setConfig] = useState<xp_config | null>(null)
  const [rewards, setRewards] = useState<xp_reward[]>([])

  const [new_ignored_channel, setNewIgnoredChannel] = useState('')
  const [new_ignored_role, setNewIgnoredRole] = useState('')

  const [new_multiplier_role, setNewMultiplierRole] = useState('')
  const [new_multiplier_value, setNewMultiplierValue] = useState('1.0')

  const [new_reward_level, setNewRewardLevel] = useState('')
  const [new_reward_role, setNewRewardRole] = useState('')

  const [reset_confirm, setResetConfirm] = useState('')
  const [reset_user_id, setResetUserId] = useState('')
  const [reset_user_confirm, setResetUserConfirm] = useState('')
  const [reset_global_confirm, setResetGlobalConfirm] = useState('')
  const [reset_global_user_id, setResetGlobalUserId] = useState('')

  useEffect(() => {
    if (!xp_data?.config) return
    if (has_initialized.current) return
    has_initialized.current = true

    const initial_config = xp_data.config

    setConfig({
      enabled: initial_config.enabled ?? true,

      minMessageLength: initial_config.minMessageLength ?? 5,
      minUniqueLength: initial_config.minUniqueLength ?? 12,
      typingCps: initial_config.typingCps ?? 7,
      xpDivisorMin: initial_config.xpDivisorMin ?? 7,
      xpDivisorMax: initial_config.xpDivisorMax ?? 4,
      xpCap: initial_config.xpCap ?? 35,

      ignoredChannelIds: (initial_config.ignoredChannelIds as any) ?? [],
      ignoredRoleIds: (initial_config.ignoredRoleIds as any) ?? [],
      roleXpMultipliers: (initial_config.roleXpMultipliers as any) ?? {},

      rewardMode: (initial_config.rewardMode as any) ?? 'stack',

      levelUpChannelId: initial_config.levelUpChannelId ?? null,
      levelUpMessage: initial_config.levelUpMessage ?? null,
    })

    setRewards(xp_data.rewards ?? [])
  }, [xp_data])

  const mutation = useMutation({
    mutationFn: async (payload: { config: xp_config; rewards: xp_reward[] }) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/xp-config`, {
        ...payload.config,
        levelUpChannelId: payload.config.levelUpChannelId || null,
        levelUpMessage: payload.config.levelUpMessage || null,
        rewards: payload.rewards,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xp-config', guildId] })
      queryClient.invalidateQueries({ queryKey: ['xp-leaderboard', guildId] })
      queryClient.invalidateQueries({ queryKey: ['xp-me', guildId] })
      toast_success('Configurações de XP salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações de XP')
    },
  })

  const handle_save = () => {
    if (!config) return
    mutation.mutate({ config, rewards })
  }

  const add_ignored_channel = () => {
    if (!config) return
    if (!new_ignored_channel) return
    if (config.ignoredChannelIds.includes(new_ignored_channel)) return

    setConfig({
      ...config,
      ignoredChannelIds: [...config.ignoredChannelIds, new_ignored_channel],
    })

    setNewIgnoredChannel('')
  }

  const remove_ignored_channel = (channel_id: string) => {
    if (!config) return
    setConfig({
      ...config,
      ignoredChannelIds: config.ignoredChannelIds.filter((id) => id !== channel_id),
    })
  }

  const add_ignored_role = () => {
    if (!config) return
    if (!new_ignored_role) return
    if (config.ignoredRoleIds.includes(new_ignored_role)) return

    setConfig({
      ...config,
      ignoredRoleIds: [...config.ignoredRoleIds, new_ignored_role],
    })

    setNewIgnoredRole('')
  }

  const remove_ignored_role = (role_id: string) => {
    if (!config) return
    setConfig({
      ...config,
      ignoredRoleIds: config.ignoredRoleIds.filter((id) => id !== role_id),
    })
  }

  const add_multiplier = () => {
    if (!config) return
    if (!new_multiplier_role) return

    const parsed = Number.parseFloat(new_multiplier_value)
    if (!Number.isFinite(parsed) || parsed < 0) return

    setConfig({
      ...config,
      roleXpMultipliers: {
        ...config.roleXpMultipliers,
        [new_multiplier_role]: parsed,
      },
    })

    setNewMultiplierRole('')
    setNewMultiplierValue('1.0')
  }

  const remove_multiplier = (role_id: string) => {
    if (!config) return
    const next = { ...config.roleXpMultipliers }
    delete next[role_id]

    setConfig({
      ...config,
      roleXpMultipliers: next,
    })
  }

  const add_reward = () => {
    const level = Number.parseInt(new_reward_level, 10)
    if (!Number.isFinite(level) || level < 0) return
    if (!new_reward_role) return

    if (rewards.length >= 15) return

    const exists = rewards.some((r) => r.level === level)
    if (exists) return

    setRewards([...rewards, { level, roleId: new_reward_role }].sort((a, b) => a.level - b.level))
    setNewRewardLevel('')
    setNewRewardRole('')
  }

  const remove_reward = (level: number) => {
    setRewards(rewards.filter((r) => r.level !== level))
  }

  const render_avatar = (user_id: string, avatar: string | null) => {
    if (!avatar) {
      return (
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-border/70 bg-surface/60 text-xs font-semibold">
          <span className="text-accent">?</span>
        </div>
      )
    }

    return (
      <img
        src={`https://cdn.discordapp.com/avatars/${user_id}/${avatar}.png`}
        alt="avatar"
        className="h-9 w-9 rounded-xl"
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Níveis por Experiência</div>
            <div className="text-sm text-muted-foreground">Sistema de XP do servidor</div>
          </div>
        </div>

        <Button onClick={handle_save} isLoading={mutation.isPending} className="shrink-0">
          <Save className="h-4 w-4" />
          <span>Salvar</span>
        </Button>
      </div>

      {is_xp_error && (
        <ErrorState
          title="Falha ao carregar XP"
          description="Não foi possível carregar as configurações de XP da guild."
          onAction={() => refetch_xp()}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 p-6">
            <div className="text-sm font-semibold">Seu progresso (local)</div>
            {!my_xp ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nível</span>
                  <span className="font-semibold">{my_xp.level}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">XP</span>
                  <span className="font-semibold">{my_xp.xp}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Colocação</span>
                  <span className="font-semibold">{my_xp.position ? `#${my_xp.position}` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Próximo nível</span>
                  <span className="font-semibold">{1000 - (my_xp.xp % 1000)} XP</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 p-6">
            <div className="text-sm font-semibold">Seu progresso (global)</div>
            {!my_global_xp ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nível</span>
                  <span className="font-semibold">{my_global_xp.level}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">XP</span>
                  <span className="font-semibold">{my_global_xp.xp}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Colocação</span>
                  <span className="font-semibold">{my_global_xp.position ? `#${my_global_xp.position}` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Próximo nível</span>
                  <span className="font-semibold">{1000 - (my_global_xp.xp % 1000)} XP</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <div className="text-sm font-semibold text-red-500">Zerar XP (guild)</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Remove o XP/level de todos os usuários desta guild. Esta ação não pode ser desfeita.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <Input
              value={reset_confirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="Digite ZERAR para confirmar"
            />
            <Button
              variant="outline"
              isLoading={reset_mutation.isPending}
              disabled={reset_confirm !== 'ZERAR'}
              onClick={() => reset_mutation.mutate()}
              className="border-red-500/60 text-red-500 hover:border-red-500 hover:bg-red-500/10"
            >
              <span>Zerar XP da guild</span>
            </Button>
          </div>

          <div className="h-px w-full bg-border/60" />

          <div>
            <div className="text-sm font-semibold text-red-500">Zerar XP (usuário na guild)</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Informe o ID do usuário para remover o XP apenas dele neste servidor.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input value={reset_user_id} onChange={(e) => setResetUserId(e.target.value)} placeholder="User ID" />
            <Input
              value={reset_user_confirm}
              onChange={(e) => setResetUserConfirm(e.target.value)}
              placeholder="Digite ZERAR USUARIO"
            />
            <Button
              variant="outline"
              isLoading={reset_user_mutation.isPending}
              disabled={!reset_user_id || reset_user_confirm !== 'ZERAR USUARIO'}
              onClick={() => reset_user_mutation.mutate({ userId: reset_user_id })}
              className="border-red-500/60 text-red-500 hover:border-red-500 hover:bg-red-500/10"
            >
              <span>Zerar usuário</span>
            </Button>
          </div>

          <div className="h-px w-full bg-border/60" />

          <div>
            <div className="text-sm font-semibold text-red-500">Zerar XP global</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Restrito (allowlist). Se você não estiver autorizado, o servidor retornará Forbidden.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={reset_global_user_id}
              onChange={(e) => setResetGlobalUserId(e.target.value)}
              placeholder="(Opcional) User ID para zerar somente 1 usuário"
            />
            <Input
              value={reset_global_confirm}
              onChange={(e) => setResetGlobalConfirm(e.target.value)}
              placeholder="Digite ZERAR GLOBAL"
            />
            <Button
              variant="outline"
              isLoading={reset_global_mutation.isPending}
              disabled={reset_global_confirm !== 'ZERAR GLOBAL'}
              onClick={() =>
                reset_global_mutation.mutate(
                  reset_global_user_id
                    ? { scope: 'user', userId: reset_global_user_id }
                    : { scope: 'global' }
                )
              }
              className="border-red-500/60 text-red-500 hover:border-red-500 hover:bg-red-500/10"
            >
              <span>Zerar global</span>
            </Button>
          </div>
        </CardContent>
      </Card>

        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 p-6">
            <div className="text-sm font-semibold">Top 10 (XP local)</div>
            {!leaderboard ? (
              <Skeleton className="h-24 w-full" />
            ) : leaderboard.leaderboard.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum dado de XP ainda.</div>
            ) : (
              <div className="space-y-2">
                {leaderboard.leaderboard.map((row) => (
                  <div
                    key={row.userId}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {render_avatar(row.userId, row.avatar)}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">#{row.position} {row.username}</div>
                        <div className="text-xs text-muted-foreground">Nível {row.level} • {row.xp} XP</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardContent className="space-y-3 p-6">
            <div className="text-sm font-semibold">Top 10 (XP global)</div>
            {!global_leaderboard ? (
              <Skeleton className="h-24 w-full" />
            ) : global_leaderboard.leaderboard.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum dado de XP global ainda.</div>
            ) : (
              <div className="space-y-2">
                {global_leaderboard.leaderboard.map((row) => (
                  <div
                    key={row.userId}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {render_avatar(row.userId, row.avatar)}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">#{row.position} {row.username}</div>
                        <div className="text-xs text-muted-foreground">Nível {row.level} • {row.xp} XP</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Ativar XP</div>
              <div className="text-xs text-muted-foreground">Recompense usuários ativos com experiência ao conversar.</div>
            </div>

            <Switch
              checked={Boolean(config?.enabled)}
              onCheckedChange={(checked) => config && setConfig({ ...config, enabled: checked })}
              label="XP habilitado"
              disabled={is_xp_loading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="text-sm font-semibold">Mensagens ao subir de nível</div>

          {is_xp_loading || !config ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal de anúncio</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select
                      value={config.levelUpChannelId ?? ''}
                      onChange={(e) => setConfig({ ...config, levelUpChannelId: e.target.value || null })}
                    >
                      <option value="">Desativado</option>
                      {(channels_data?.channels ?? []).map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channel_label(ch)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Se desativado, não envia mensagem ao subir de nível.</div>
              </div>

              <div>
                <div className="text-sm font-medium">Mensagem</div>
                <div className="mt-2">
                  <Textarea
                    value={config.levelUpMessage ?? ''}
                    onChange={(e) => setConfig({ ...config, levelUpMessage: e.target.value || null })}
                    placeholder="{user} subiu para o nível {level}!"
                    rows={3}
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Variáveis: {'{user}'} e {'{level}'}.</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="text-sm font-semibold">Estilo de recompensas por cargo</div>

          {is_xp_loading || !config ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Empilhar recompensas anteriores</div>
                    <div className="mt-1 text-xs text-muted-foreground">Mantém todos os cargos de recompensa já recebidos.</div>
                  </div>
                  <Switch
                    checked={config.rewardMode === 'stack'}
                    onCheckedChange={(checked) => setConfig({ ...config, rewardMode: checked ? 'stack' : 'highest' })}
                    label=""
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Remover recompensas anteriores</div>
                    <div className="mt-1 text-xs text-muted-foreground">Mantém apenas o cargo da maior recompensa atingida.</div>
                  </div>
                  <Switch
                    checked={config.rewardMode === 'highest'}
                    onCheckedChange={(checked) => setConfig({ ...config, rewardMode: checked ? 'highest' : 'stack' })}
                    label=""
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="text-sm font-semibold">Cargos que ganham mais/menos XP</div>

          {is_xp_loading || !config ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_44px]">
                <Select value={new_multiplier_role} onChange={(e) => setNewMultiplierRole(e.target.value)}>
                  <option value="">Selecione um cargo</option>
                  {(roles_data?.roles ?? []).filter((r) => !r.managed).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                <Input
                  value={new_multiplier_value}
                  onChange={(e) => setNewMultiplierValue(e.target.value)}
                  placeholder="1.0"
                />
                <Button variant="outline" onClick={add_multiplier} className="px-0" aria-label="Adicionar multiplicador">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-2">
                {Object.entries(config.roleXpMultipliers).length === 0 ? (
                  <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4 text-center text-sm text-muted-foreground">
                    Nenhum multiplicador configurado
                  </div>
                ) : (
                  Object.entries(config.roleXpMultipliers)
                    .sort((a, b) => (role_by_id.get(b[0])?.position ?? 0) - (role_by_id.get(a[0])?.position ?? 0))
                    .map(([role_id, value]) => (
                      <div
                        key={role_id}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{role_by_id.get(role_id)?.name ?? role_id}</div>
                          <div className="text-xs text-muted-foreground">{value}x XP</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => remove_multiplier(role_id)} aria-label="Remover multiplicador">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="text-sm font-semibold">Cargos que não irão receber experiência</div>

            {is_xp_loading || !config ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_44px]">
                  <Select value={new_ignored_role} onChange={(e) => setNewIgnoredRole(e.target.value)}>
                    <option value="">Selecione um cargo</option>
                    {(roles_data?.roles ?? []).filter((r) => !r.managed).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                  <Button variant="outline" onClick={add_ignored_role} className="px-0" aria-label="Adicionar cargo ignorado">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {config.ignoredRoleIds.length === 0 ? (
                    <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4 text-center text-sm text-muted-foreground">
                      Nenhum cargo ignorado
                    </div>
                  ) : (
                    config.ignoredRoleIds.map((role_id) => (
                      <div
                        key={role_id}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3"
                      >
                        <div className="truncate text-sm font-semibold">{role_by_id.get(role_id)?.name ?? role_id}</div>
                        <Button variant="ghost" size="sm" onClick={() => remove_ignored_role(role_id)} aria-label="Remover cargo ignorado">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="text-sm font-semibold">Canais que não irão dar experiência</div>

            {is_xp_loading || !config ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_44px]">
                  <Select value={new_ignored_channel} onChange={(e) => setNewIgnoredChannel(e.target.value)}>
                    <option value="">Selecione um canal</option>
                    {(channels_data?.channels ?? []).map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {channel_label(ch)}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="outline"
                    onClick={add_ignored_channel}
                    className="px-0"
                    aria-label="Adicionar canal ignorado"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {config.ignoredChannelIds.length === 0 ? (
                    <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4 text-center text-sm text-muted-foreground">
                      Nenhum canal ignorado
                    </div>
                  ) : (
                    config.ignoredChannelIds.map((channel_id) => (
                      <div
                        key={channel_id}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3"
                      >
                        <div className="truncate text-sm font-semibold">{channel_by_id.get(channel_id)?.name ? `#${channel_by_id.get(channel_id)!.name}` : channel_id}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove_ignored_channel(channel_id)}
                          aria-label="Remover canal ignorado"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Recompensas ao subir de nível</div>
              <div className="mt-1 text-xs text-muted-foreground">Máximo de 15 cargos por experiência.</div>
            </div>
            <div className="text-xs text-muted-foreground">{rewards.length}/15</div>
          </div>

          {is_xp_loading || !config ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_44px]">
                <Input
                  value={new_reward_level}
                  onChange={(e) => setNewRewardLevel(e.target.value)}
                  placeholder="Nível"
                />
                <Select value={new_reward_role} onChange={(e) => setNewRewardRole(e.target.value)}>
                  <option value="">Selecione um cargo</option>
                  {(roles_data?.roles ?? []).filter((r) => !r.managed).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                <Button variant="outline" onClick={add_reward} className="px-0" aria-label="Adicionar recompensa">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-2">
                {rewards.length === 0 ? (
                  <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4 text-center text-sm text-muted-foreground">
                    Nenhuma recompensa configurada
                  </div>
                ) : (
                  rewards.map((reward) => (
                    <div
                      key={reward.level}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Ao chegar no nível {reward.level}</div>
                        <div className="text-xs text-muted-foreground">Dar o cargo {role_by_id.get(reward.roleId)?.name ?? reward.roleId}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => remove_reward(reward.level)} aria-label="Remover recompensa">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="text-sm font-semibold">Regras (avançado)</div>
          <div className="text-xs text-muted-foreground">Ajuste os parâmetros do ganho de XP conforme a sua preferência.</div>

          {is_xp_loading || !config ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-medium">Mínimo de caracteres</div>
                <div className="mt-2">
                  <Input
                    value={String(config.minMessageLength)}
                    onChange={(e) => setConfig({ ...config, minMessageLength: Number.parseInt(e.target.value || '0', 10) || 0 })}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Mínimo (sem repetição)</div>
                <div className="mt-2">
                  <Input
                    value={String(config.minUniqueLength)}
                    onChange={(e) => setConfig({ ...config, minUniqueLength: Number.parseInt(e.target.value || '0', 10) || 0 })}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Chars/seg (typing)</div>
                <div className="mt-2">
                  <Input
                    value={String(config.typingCps)}
                    onChange={(e) => setConfig({ ...config, typingCps: Number.parseInt(e.target.value || '1', 10) || 1 })}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Divisor mínimo</div>
                <div className="mt-2">
                  <Input
                    value={String(config.xpDivisorMin)}
                    onChange={(e) => setConfig({ ...config, xpDivisorMin: Number.parseInt(e.target.value || '1', 10) || 1 })}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Divisor máximo</div>
                <div className="mt-2">
                  <Input
                    value={String(config.xpDivisorMax)}
                    onChange={(e) => setConfig({ ...config, xpDivisorMax: Number.parseInt(e.target.value || '1', 10) || 1 })}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Cap de XP</div>
                <div className="mt-2">
                  <Input
                    value={String(config.xpCap)}
                    onChange={(e) => setConfig({ ...config, xpCap: Number.parseInt(e.target.value || '1', 10) || 1 })}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(is_channels_loading || is_roles_loading) && (
        <div className="text-xs text-muted-foreground">
          Carregando dados do servidor...
        </div>
      )}
    </div>
  )
}
