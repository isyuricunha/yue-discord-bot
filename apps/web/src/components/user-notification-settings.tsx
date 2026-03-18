import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Bell, Volume2 } from 'lucide-react'

import { getApiUrl } from '../env'
import { Card, CardContent, ErrorState, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

interface notification_settings_response {
    success: boolean
    notifications: {
        voiceXpEnabled: boolean
    }
}

interface notification_settings_update {
    voiceXpNotificationsEnabled: boolean
}

export function UserNotificationSettings() {
    const queryClient = useQueryClient()

    const {
        data: notificationData,
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ['user-notification-settings'],
        queryFn: async () => {
            const response = await axios.get<notification_settings_response>(
                `${API_URL}/api/profile/me/notifications`
            )
            return response.data
        },
    })

    const updateMutation = useMutation({
        mutationFn: async (data: notification_settings_update) => {
            const response = await axios.patch<notification_settings_response>(
                `${API_URL}/api/profile/me/notifications`,
                data
            )
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user-notification-settings'] })
            toast_success('Configurações salvas com sucesso!')
        },
        onError: (error: unknown) => {
            const axiosError = error as { response?: { data?: { error?: string } } }
            toast_error(
                axiosError.response?.data?.error ||
                'Erro ao salvar configurações de notificação'
            )
        },
    })

    const handleVoiceXpToggle = (checked: boolean) => {
        updateMutation.mutate({ voiceXpNotificationsEnabled: checked })
    }

    if (isError) {
        return (
            <Card>
                <CardContent className="p-6">
                    <ErrorState
                        title="Falha ao carregar configurações"
                        description="Não foi possível carregar as suas configurações de notificação."
                        onAction={() => refetch()}
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardContent className="space-y-6 p-6">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                        <Bell className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="text-xl font-semibold tracking-tight">
                            Notificações
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Configure como você recebe notificações
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/40 p-4">
                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface/60">
                                <Volume2 className="h-5 w-5 text-accent" />
                            </div>
                            <div>
                                <div className="font-medium">Notificações de XP por Voz</div>
                                <div className="text-sm text-muted-foreground">
                                    Receba notificações quando ganhar XP em canais de voz
                                </div>
                            </div>
                        </div>
                        {isLoading ? (
                            <Skeleton className="h-7 w-12" />
                        ) : (
                            <Switch
                                checked={notificationData?.notifications.voiceXpEnabled ?? true}
                                onCheckedChange={handleVoiceXpToggle}
                                disabled={updateMutation.isPending}
                            />
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
