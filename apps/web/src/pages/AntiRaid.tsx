import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Shield, AlertTriangle, Bell, Users, Ban } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, ErrorState, Input, Select, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'
import { use_unsaved_changes_warning } from '../lib/use_unsaved_changes_warning'
import { Hash, X } from 'lucide-react'

const API_URL = getApiUrl()

type antiraid_action = 'mute' | 'kick' | 'ban'

const action_label: Record<antiraid_action, string> = {
    mute: 'Silenciar',
    kick: 'Expulsar',
    ban: 'Banir',
}

const action_description: Record<antiraid_action, string> = {
    mute: 'Aplica timeout no membro por tempo determinado.',
    kick: 'Expulsa o membro do servidor.',
    ban: 'Bane o membro do servidor permanentemente.',
}

interface AntiRaidConfig {
    id: string
    guildId: string
    enabled: boolean
    joinThreshold: number
    joinTimeWindow: number
    action: antiraid_action
    duration: number
    exemptRoles: string[]
    exemptChannels: string[]
    cooldown: number
    notificationChannelId: string | null
    raidActive: boolean
    locked: boolean
    lastRaidAt: Date | null
}

export default function AntiRaidPage() {
    const { guildId } = useParams()
    const queryClient = useQueryClient()

    const [config, setConfig] = useState<Partial<AntiRaidConfig>>({})
    const initial_config_ref = useRef<Partial<AntiRaidConfig> | null>(null)

    const {
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ['antiraid-config', guildId],
        queryFn: async () => {
            const response = await axios.get(`${API_URL}/api/guilds/${guildId}/antiraid-config`)
            const initialConfig = response.data.config || {
                enabled: false,
                joinThreshold: 10,
                joinTimeWindow: 60,
                action: 'mute',
                duration: 10,
                exemptRoles: [],
                exemptChannels: [],
                cooldown: 300,
                notificationChannelId: null,
                raidActive: false,
                locked: false,
            }

            if (!initial_config_ref.current) {
                initial_config_ref.current = initialConfig
            }
            setConfig(initialConfig)
            return response.data
        },
    })

    const { data: channelsRes } = useQuery({
        queryKey: ['channels', guildId],
        queryFn: async () => {
            const response = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
            return response.data
        },
    })

    const { data: rolesRes } = useQuery({
        queryKey: ['roles', guildId],
        queryFn: async () => {
            const response = await axios.get(`${API_URL}/api/guilds/${guildId}/roles`)
            return response.data
        },
    })

    const channels = channelsRes?.channels || []
    const roles = rolesRes?.roles || []

    const has_changes = useMemo(() => {
        const initial = initial_config_ref.current
        if (!initial) return false

        return JSON.stringify(initial) !== JSON.stringify(config)
    }, [config])

    use_unsaved_changes_warning({
        enabled: has_changes,
        message: 'Você tem alterações pendentes. Deseja realmente sair desta página?',
    })

    const mutation = useMutation({
        mutationFn: async (data: Partial<AntiRaidConfig>) => {
            await axios.put(`${API_URL}/api/guilds/${guildId}/antiraid-config`, data)
        },
        onSuccess: (_data, variables) => {
            initial_config_ref.current = variables
            setConfig(variables)
            queryClient.invalidateQueries({ queryKey: ['antiraid-config', guildId] })
            toast_success('Configurações salvas com sucesso!')
        },
        onError: (error: any) => {
            toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
        },
    })

    const handleSave = () => {
        mutation.mutate(config)
    }

    const is_disabled = isLoading || isError || mutation.isPending

    const handleToggle = (checked: boolean) => {
        setConfig({ ...config, enabled: checked })
    }

    const handleThresholdChange = (value: string) => {
        const parsed = Number.parseInt(value, 10)
        setConfig({ ...config, joinThreshold: Number.isNaN(parsed) ? 10 : parsed })
    }

    const handleTimeWindowChange = (value: string) => {
        const parsed = Number.parseInt(value, 10)
        setConfig({ ...config, joinTimeWindow: Number.isNaN(parsed) ? 60 : parsed })
    }

    const handleDurationChange = (value: string) => {
        const parsed = Number.parseInt(value, 10)
        setConfig({ ...config, duration: Number.isNaN(parsed) ? 10 : parsed })
    }

    const handleCooldownChange = (value: string) => {
        const parsed = Number.parseInt(value, 10)
        setConfig({ ...config, cooldown: Number.isNaN(parsed) ? 300 : parsed })
    }

    const toggleExemptRole = (roleId: string) => {
        if (!roleId) return
        const current = config.exemptRoles || []
        if (current.includes(roleId)) {
            setConfig({ ...config, exemptRoles: current.filter((id) => id !== roleId) })
        } else {
            setConfig({ ...config, exemptRoles: [...current, roleId] })
        }
    }

    const toggleExemptChannel = (channelId: string) => {
        if (!channelId) return
        const current = config.exemptChannels || []
        if (current.includes(channelId)) {
            setConfig({ ...config, exemptChannels: current.filter((id) => id !== channelId) })
        } else {
            setConfig({ ...config, exemptChannels: [...current, channelId] })
        }
    }

    const getRoleMap = () => {
        const map: Record<string, any> = {}
        for (const r of roles) map[r.id] = r
        return map
    }
    const getChannelMap = () => {
        const map: Record<string, any> = {}
        for (const c of channels) map[c.id] = c
        return map
    }

    const roleMap = getRoleMap()
    const channelMap = getChannelMap()

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                        <Shield className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="text-xl font-semibold tracking-tight">Anti-Raide</div>
                        <div className="text-sm text-muted-foreground">Proteção contra ataques de raide</div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {has_changes && <Badge>Alterações pendentes</Badge>}
                    <Button
                        onClick={handleSave}
                        isLoading={mutation.isPending}
                        disabled={is_disabled || !has_changes}
                        className="shrink-0"
                    >
                        <Save className="h-4 w-4" />
                        <span>Salvar</span>
                    </Button>
                </div>
            </div>

            {isError && (
                <ErrorState
                    title="Falha ao carregar Anti-Raide"
                    description="Não foi possível carregar as configurações da guild."
                    onAction={() => refetch()}
                />
            )}

            <Card>
                <CardContent className="space-y-3 p-6">
                    <div className="text-sm font-semibold">O que significa cada ação?</div>
                    <div className="text-sm text-muted-foreground">
                        Quando um raide é detectado, o sistema ira aplicar a ação escolhida nos membros recentes.
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {(Object.keys(action_label) as antiraid_action[]).map((key) => (
                            <div key={key} className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                                <div className="text-sm font-medium">{action_label[key]}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{action_description[key]}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-accent" />
                            <div>
                                <div className="text-sm font-semibold">Proteção contra Raide</div>
                                <div className="text-xs text-muted-foreground">
                                    Ative para proteger o servidor contra ataques de raide
                                </div>
                            </div>
                        </div>

                        <Switch
                            checked={Boolean(config.enabled)}
                            onCheckedChange={handleToggle}
                            label="Habilitar Anti-Raide"
                            disabled={isLoading}
                        />
                    </div>

                    {config.raidActive && (
                        <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3">
                            <div className="flex items-center gap-2 text-red-500">
                                <AlertTriangle className="h-5 w-5" />
                                <span className="font-medium">Raide ativo no momento!</span>
                            </div>
                            <div className="mt-1 text-sm text-red-400">
                                O sistema está aplicando proteção automaticamente.
                            </div>
                        </div>
                    )}

                    {config.locked && (
                        <div className="rounded-xl border border-yellow-500/50 bg-yellow-500/10 px-4 py-3">
                            <div className="flex items-center gap-2 text-yellow-500">
                                <Ban className="h-5 w-5" />
                                <span className="font-medium">Servidor bloqueado!</span>
                            </div>
                            <div className="mt-1 text-sm text-yellow-400">
                                O servidor está com mensagens bloqueadas para membros.
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {Boolean(config.enabled) && (
                <>
                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-accent" />
                                <div className="text-sm font-semibold">Configurações de Detecção</div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <div className="text-sm font-medium">Limite de entradas</div>
                                    <div className="text-xs text-muted-foreground mb-2">
                                        Número de membros que podem entrar no período determinado
                                    </div>
                                    <Input
                                        type="number"
                                        min={3}
                                        max={50}
                                        value={String(config.joinThreshold ?? 10)}
                                        onChange={(e) => handleThresholdChange(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>

                                <div>
                                    <div className="text-sm font-medium">Janela de tempo (segundos)</div>
                                    <div className="text-xs text-muted-foreground mb-2">
                                        Período em segundos para contar as entradas
                                    </div>
                                    <Input
                                        type="number"
                                        min={10}
                                        max={300}
                                        value={String(config.joinTimeWindow ?? 60)}
                                        onChange={(e) => handleTimeWindowChange(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="mt-4">
                                <div className="text-sm font-medium mb-2">Exemplo de configuração</div>
                                <div className="text-sm text-muted-foreground">
                                    Se <strong>{config.joinThreshold ?? 10}</strong> membros entrarem em{' '}
                                    <strong>{config.joinTimeWindow ?? 60}</strong> segundos, um raide será detectado.
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <div className="flex items-center gap-3">
                                <Ban className="h-5 w-5 text-accent" />
                                <div className="text-sm font-semibold">Ação quando detectado</div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div>
                                    <div className="text-sm font-medium">Ação</div>
                                    <div className="mt-2">
                                        <Select
                                            value={config.action ?? 'mute'}
                                            onValueChange={(value) => setConfig({ ...config, action: value as antiraid_action })}
                                            disabled={isLoading}
                                        >
                                            <option value="mute">{action_label.mute}</option>
                                            <option value="kick">{action_label.kick}</option>
                                            <option value="ban">{action_label.ban}</option>
                                        </Select>
                                    </div>
                                </div>

                                {config.action === 'mute' && (
                                    <div>
                                        <div className="text-sm font-medium">Duração do mute (minutos)</div>
                                        <div className="mt-2">
                                            <Input
                                                type="number"
                                                min={1}
                                                max={60}
                                                value={String(config.duration ?? 10)}
                                                onChange={(e) => handleDurationChange(e.target.value)}
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="text-sm font-medium">Cooldown após raide (segundos)</div>
                                    <div className="text-xs text-muted-foreground mb-2">
                                        Tempo antes de detectar outro raide
                                    </div>
                                    <Input
                                        type="number"
                                        min={60}
                                        max={3600}
                                        value={String(config.cooldown ?? 300)}
                                        onChange={(e) => handleCooldownChange(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <div className="flex items-center gap-3">
                                <Bell className="h-5 w-5 text-accent" />
                                <div className="text-sm font-semibold">Notificações</div>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                Selecione um canal de texto para o bot reportar detecções de raide.
                            </div>

                            <Select
                                value={config.notificationChannelId || ''}
                                onValueChange={(v) => setConfig({ ...config, notificationChannelId: v || null })}
                                disabled={isLoading}
                            >
                                <option value="">Nenhum / Desativado</option>
                                {channels.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        #{c.name}
                                    </option>
                                ))}
                            </Select>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-accent" />
                                <div className="text-sm font-semibold">Isenções</div>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                Configure cargos e canais específicos que nunca sofrerão ações do sistema Anti-Raide.
                            </div>

                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="space-y-3">
                                    <div className="text-sm font-medium">Cargos Isentos</div>
                                    <Select value="" onValueChange={toggleExemptRole} disabled={isLoading}>
                                        <option value="">Adicionar cargo...</option>
                                        {roles.map((r: any) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </Select>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(config.exemptRoles || []).map((roleId) => {
                                            const role = roleMap[roleId]
                                            return (
                                                <Badge
                                                    key={roleId}
                                                    className="flex items-center gap-1.5 cursor-pointer hover:bg-destructive/20 hover:text-destructive hover:border-destructive transition-colors"
                                                    onClick={() => toggleExemptRole(roleId)}
                                                >
                                                    {role && (
                                                        <span
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` }}
                                                        />
                                                    )}
                                                    {role ? role.name : roleId}
                                                    <X className="w-3 h-3 ml-1 opacity-50" />
                                                </Badge>
                                            )
                                        })}
                                        {!(config.exemptRoles?.length) && (
                                            <span className="text-xs text-muted-foreground italic">Nenhum cargo isento</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-sm font-medium">Canais Isentos</div>
                                    <Select value="" onValueChange={toggleExemptChannel} disabled={isLoading}>
                                        <option value="">Adicionar canal...</option>
                                        {channels.map((c: any) => (
                                            <option key={c.id} value={c.id}>
                                                #{c.name}
                                            </option>
                                        ))}
                                    </Select>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(config.exemptChannels || []).map((channelId) => {
                                            const channel = channelMap[channelId]
                                            return (
                                                <Badge
                                                    key={channelId}
                                                    className="flex items-center gap-1.5 cursor-pointer hover:bg-destructive/20 hover:text-destructive hover:border-destructive transition-colors"
                                                    onClick={() => toggleExemptChannel(channelId)}
                                                >
                                                    <Hash className="w-3 h-3 opacity-50" />
                                                    {channel ? channel.name : channelId}
                                                    <X className="w-3 h-3 ml-1 opacity-50" />
                                                </Badge>
                                            )
                                        })}
                                        {!(config.exemptChannels?.length) && (
                                            <span className="text-xs text-muted-foreground italic">Nenhum canal isento</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            <Card>
                <CardContent className="space-y-3 p-6">
                    <div className="text-sm font-semibold">Status Atual</div>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Status:</span>{' '}
                                <span className={config.enabled ? 'text-green-500' : 'text-muted-foreground'}>
                                    {config.enabled ? 'Ativado' : 'Desativado'}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Último raide:</span>{' '}
                                <span>{config.lastRaidAt ? new Date(config.lastRaidAt).toLocaleString('pt-BR') : 'Nunca'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Cooldown:</span>{' '}
                                <span>{(config.cooldown ?? 300) / 60} minutos</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Ação:</span>{' '}
                                <span>{action_label[config.action as antiraid_action] || 'Mute'}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
