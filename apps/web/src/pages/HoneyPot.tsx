import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Shield, Info } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, ErrorState, Select, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'
import { use_unsaved_changes_warning } from '../lib/use_unsaved_changes_warning'

const API_URL = getApiUrl()

interface HoneyPotConfig {
    channelId: string | null
}

export default function HoneyPotPage() {
    const { guildId } = useParams()
    const queryClient = useQueryClient()

    const [config, setConfig] = useState<Partial<HoneyPotConfig>>({})
    const initial_config_ref = useRef<Partial<HoneyPotConfig> | null>(null)

    const {
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ['honeypot-config', guildId],
        queryFn: async () => {
            const response = await axios.get(`${API_URL}/api/guilds/${guildId}/honeypot-config`)
            const initialConfig = response.data.config || { channelId: null }

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

    const text_channels = (channelsRes?.channels || []).filter((c: any) => c.type === 0)

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
        mutationFn: async (data: Partial<HoneyPotConfig>) => {
            await axios.put(`${API_URL}/api/guilds/${guildId}/honeypot-config`, data)
        },
        onSuccess: (_data, variables) => {
            initial_config_ref.current = variables
            setConfig(variables)
            queryClient.invalidateQueries({ queryKey: ['honeypot-config', guildId] })
            toast_success('Configurações salvas com sucesso!')
        },
        onError: (error: any) => {
            toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
        },
    })

    const handleSave = () => {
        if (config.channelId === '') {
            toast_error('Selecione um canal para a armadilha antes de salvar.')
            return
        }
        mutation.mutate({ channelId: config.channelId ?? null })
    }

    const is_disabled = isLoading || isError || mutation.isPending

    const handleToggle = (checked: boolean) => {
        setConfig({ channelId: checked ? (config.channelId ?? '') : null })
    }

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                        <Shield className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="text-xl font-semibold tracking-tight">Canal Armadilha</div>
                        <div className="text-sm text-muted-foreground">Canal isca contra spam e contas comprometidas</div>
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
                    title="Falha ao carregar o Canal Armadilha"
                    description="Não foi possível carregar as configurações da guild."
                    onAction={() => refetch()}
                />
            )}

            <Card>
                <CardContent className="space-y-4 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-accent" />
                            <div>
                                <div className="text-sm font-semibold">Canal armadilha</div>
                                <div className="text-xs text-muted-foreground">
                                    Ative para transformar um canal em isca contra spam
                                </div>
                            </div>
                        </div>

                        <Switch
                            checked={config.channelId !== null && config.channelId !== undefined}
                            onCheckedChange={handleToggle}
                            label="Habilitar canal armadilha"
                            disabled={isLoading}
                        />
                    </div>
                </CardContent>
            </Card>

            {config.channelId !== null && config.channelId !== undefined && (
                <Card>
                    <CardContent className="space-y-4 p-6">
                        <div>
                            <div className="text-sm font-medium mb-2">Canal da armadilha</div>
                            <div className="text-xs text-muted-foreground mb-2">
                                Recomendamos criar um canal dedicado no topo do servidor com um nome chamativo.
                            </div>
                            <Select
                                value={config.channelId || ''}
                                onValueChange={(v) => setConfig({ channelId: v || '' })}
                                disabled={isLoading}
                            >
                                <option value="">Escolher canal</option>
                                {text_channels.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        #{c.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="space-y-3 p-6">
                    <div className="flex items-center gap-3">
                        <Info className="h-5 w-5 text-accent" />
                        <div className="text-sm font-semibold">Como funciona</div>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-2">
                        <p>
                            Qualquer mensagem postada no canal armadilha resulta em{' '}
                            <strong>banimento automático</strong> do remetente, e as mensagens dele dos últimos 10
                            minutos são apagadas no servidor inteiro. Botões de spam e contas comprometidas postam em
                            todos os canais, então caem na isca.
                        </p>
                        <p>
                            Isenções: staff com permissão de banimento, silenciamento ou gerenciar servidor não é
                            afetado. Webhooks e o próprio bot Yue são ignorados; bots de terceiros que postarem no
                            canal também são banidos.
                        </p>
                        <p>
                            Um aviso é postado no canal quando ele é configurado pelo comando{' '}
                            <code>/armadilha</code>. Mudanças feitas aqui podem levar até 5 minutos para valer no bot.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
