import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Gift } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Select, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

// Platform and type constants (from gamerpower.service.ts)
const PLATFORMS = [
    { id: 'steam', name: 'Steam' },
    { id: 'epic-games-store', name: 'Epic Games Store' },
    { id: 'gog', name: 'GOG' },
    { id: 'itch.io', name: 'Itch.io' },
    { id: 'xbox', name: 'Xbox' },
    { id: 'xbox-series-xs', name: 'Xbox Series X|S' },
    { id: 'ps4', name: 'PS4' },
    { id: 'ps5', name: 'PS5' },
    { id: 'android', name: 'Android' },
    { id: 'ios', name: 'iOS' },
    { id: 'switch', name: 'Nintendo Switch' },
    { id: 'vr', name: 'VR' },
    { id: 'ubisoft', name: 'Ubisoft' },
    { id: 'battlenet', name: 'Battle.net' },
    { id: 'origin', name: 'Origin' },
    { id: 'drm-free', name: 'DRM-Free' },
] as const

const TYPES = [
    { id: 'game', name: 'Jogo' },
    { id: 'loot', name: 'Itens' },
    { id: 'beta', name: 'Beta' },
] as const

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

type free_games_config = {
    channelId: string | null
    roleIds: string[]
    platforms: string[]
    giveawayTypes: string[]
    isEnabled: boolean
    lastCheckedAt: string | null
}

function channel_label(channel: api_channel) {
    return `#${channel.name}`
}

const CHANNEL_TYPE_GUILD_TEXT = 0
const CHANNEL_TYPE_GUILD_ANNOUNCEMENT = 5

export default function FreeGamesPage() {
    const { guildId } = useParams()
    const queryClient = useQueryClient()
    const has_initialized = useRef(false)

    const [config, set_config] = useState<free_games_config | null>(null)

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
        data: config_data,
        isLoading: is_config_loading,
        isError: is_config_error,
        refetch: refetch_config,
    } = useQuery({
        queryKey: ['free-games-config', guildId],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/api/guilds/${guildId}/free-games-config`)
            return res.data as { success: boolean; config: free_games_config }
        },
    })

    useEffect(() => {
        if (!config_data?.config) return
        if (has_initialized.current) return
        has_initialized.current = true

        set_config({
            channelId: config_data.config.channelId ?? null,
            roleIds: Array.isArray(config_data.config.roleIds) ? config_data.config.roleIds : [],
            platforms: Array.isArray(config_data.config.platforms) ? config_data.config.platforms : [],
            giveawayTypes: Array.isArray(config_data.config.giveawayTypes) ? config_data.config.giveawayTypes : [],
            isEnabled: config_data.config.isEnabled ?? true,
            lastCheckedAt: config_data.config.lastCheckedAt,
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

    const roles = roles_data?.roles ?? []
    const available_roles = roles
        .filter((r) => !r.managed)
        .sort((a, b) => b.position - a.position)

    const save_mutation = useMutation({
        mutationFn: async (payload: free_games_config) => {
            await axios.put(`${API_URL}/api/guilds/${guildId}/free-games-config`, {
                channelId: payload.channelId,
                roleIds: payload.roleIds,
                platforms: payload.platforms,
                giveawayTypes: payload.giveawayTypes,
                isEnabled: payload.isEnabled,
            })
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['free-games-config', guildId] })
            toast_success('Configurações salvas com sucesso!')
        },
        onError: (error: any) => {
            toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
        },
    })

    const is_loading = is_channels_loading || is_roles_loading || is_config_loading
    const is_error = is_channels_error || is_roles_error || is_config_error

    const toggle_platform = (platformId: string) => {
        if (!config) return
        const new_platforms = config.platforms.includes(platformId)
            ? config.platforms.filter((p) => p !== platformId)
            : [...config.platforms, platformId]
        set_config({ ...config, platforms: new_platforms })
    }

    const toggle_type = (typeId: string) => {
        if (!config) return
        const new_types = config.giveawayTypes.includes(typeId)
            ? config.giveawayTypes.filter((t) => t !== typeId)
            : [...config.giveawayTypes, typeId]
        set_config({ ...config, giveawayTypes: new_types })
    }

    const toggle_role = (roleId: string) => {
        if (!config) return
        const new_roles = config.roleIds.includes(roleId)
            ? config.roleIds.filter((r) => r !== roleId)
            : [...config.roleIds, roleId]
        set_config({ ...config, roleIds: new_roles })
    }

    const handle_save = () => {
        if (!config) return
        save_mutation.mutate(config)
    }

    const is_save_disabled = !config || is_loading || (config.isEnabled && !config.channelId)

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                        <Gift className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="text-xl font-semibold tracking-tight">Jogos Grátis</div>
                        <div className="text-sm text-muted-foreground">Notificações de jogos gratuitos</div>
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
                            refetch_config()
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
                    title="Erro ao carregar configurações"
                    description="Não foi possível carregar as configurações de jogos grátis."
                    actionLabel="Tentar novamente"
                    onAction={() => {
                        refetch_channels()
                        refetch_roles()
                        refetch_config()
                    }}
                />
            )}

            <Card>
                <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-sm font-semibold">Ativar notificações</div>
                            <div className="text-xs text-muted-foreground">
                                Receba notificações sobre jogos gratuitos disponíveis na GamerPower.
                            </div>
                        </div>

                        <Switch
                            checked={Boolean(config?.isEnabled)}
                            onCheckedChange={(checked) => config && set_config({ ...config, isEnabled: checked })}
                            disabled={is_loading}
                        />
                    </div>
                </CardContent>
            </Card>

            {is_loading || !config ? (
                <Skeleton className="h-64 w-full" />
            ) : (
                <>
                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <div className="text-sm font-semibold">Canal de Notificação</div>
                            <div className="text-xs text-muted-foreground">
                                Selecione o canal onde as notificações de jogos grátis serão enviadas.
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <Select
                                        value={config.channelId ?? ''}
                                        onValueChange={(value) => set_config({ ...config, channelId: value || null })}
                                    >
                                        <option value="">Selecione um canal</option>
                                        {text_channels.map((ch) => (
                                            <option key={ch.id} value={ch.id}>
                                                {channel_label(ch)}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <div className="text-sm font-semibold">Cargos para Mencionar</div>
                            <div className="text-xs text-muted-foreground">
                                Selecione os cargos que serão mencionados quando houver um novo jogo grátis.
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {available_roles.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Nenhum cargo disponível.</div>
                                ) : (
                                    available_roles.map((role) => {
                                        const is_selected = config.roleIds.includes(role.id)
                                        return (
                                            <div
                                                key={role.id}
                                                onClick={() => toggle_role(role.id)}
                                                className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors ${is_selected
                                                    ? 'border-accent/60 bg-accent/10'
                                                    : 'border-border/70 hover:bg-surface/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-3 w-3 rounded-full"
                                                        style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#808080' }}
                                                    />
                                                    <span className="text-sm font-medium">{role.name}</span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <div className="text-sm font-semibold">Filtrar por Plataforma</div>
                            <div className="text-xs text-muted-foreground">
                                Selecione as plataformas desejadas. Deixe vazio para todas.
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                {PLATFORMS.map((platform) => {
                                    const is_selected = config.platforms.includes(platform.id)
                                    return (
                                        <div
                                            key={platform.id}
                                            onClick={() => toggle_platform(platform.id)}
                                            className={`cursor-pointer rounded-xl border px-4 py-3 text-center transition-colors ${is_selected
                                                ? 'border-accent/60 bg-accent/10'
                                                : 'border-border/70 hover:bg-surface/50'
                                                }`}
                                        >
                                            <span className="text-sm font-medium">{platform.name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <div className="text-sm font-semibold">Filtrar por Tipo</div>
                            <div className="text-xs text-muted-foreground">
                                Selecione os tipos de giveaway desejados. Deixe vazio para todos.
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                {TYPES.map((type) => {
                                    const is_selected = config.giveawayTypes.includes(type.id)
                                    return (
                                        <div
                                            key={type.id}
                                            onClick={() => toggle_type(type.id)}
                                            className={`cursor-pointer rounded-xl border px-4 py-3 text-center transition-colors ${is_selected
                                                ? 'border-accent/60 bg-accent/10'
                                                : 'border-border/70 hover:bg-surface/50'
                                                }`}
                                        >
                                            <span className="text-sm font-medium">{type.name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            <Card className="border-accent/20">
                <CardContent className="p-6 text-sm text-muted-foreground">
                    <div className="space-y-2">
                        <div>
                            <span className="font-semibold text-foreground">Nota:</span> As notificações são enviadas pelo bot
                            automaticamente quando novos jogos grátis são encontrados na API GamerPower.
                        </div>
                        <div>
                            <span className="font-semibold text-foreground">Dica:</span> Para obter melhores resultados, filtre por
                            plataformas e tipos específicos para evitar spam no servidor.
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
