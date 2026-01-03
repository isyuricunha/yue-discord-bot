import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Select, Skeleton } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type api_role = {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
}

type guild_config = {
  muteRoleId?: string | null
}

type automod_config_response = {
  success: boolean
  config: {
    muteRoleId: string | null
  }
}

export default function ModerationPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const {
    data: config_data,
    isLoading: is_config_loading,
    isError: is_config_error,
    refetch: refetch_config,
  } = useQuery({
    queryKey: ['automod-config', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/automod-config`)
      return response.data as automod_config_response
    },
  })

  const config = (config_data?.config as guild_config | undefined) ?? undefined

  const { data: roles_data, isLoading: is_roles_loading } = useQuery({
    queryKey: ['roles', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/roles`)
      return response.data as { success: boolean; roles: api_role[] }
    },
  })

  const available_roles = useMemo(() => {
    const roles = roles_data?.roles ?? []
    return roles
      .filter((r) => !r.managed)
      .slice()
      .sort((a, b) => b.position - a.position)
  }, [roles_data])

  const [mute_role_id, set_mute_role_id] = useState('')
  const has_initialized = useRef(false)

  useEffect(() => {
    if (!config) return
    if (has_initialized.current) return
    has_initialized.current = true

    set_mute_role_id(config.muteRoleId ?? '')
  }, [config])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/automod-config`, {
        muteRoleId: mute_role_id || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automod-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-semibold tracking-tight">Moderação</div>
          <div className="mt-1 text-sm text-muted-foreground">Configurações de punição e automação</div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending}
          disabled={is_config_loading || is_config_error || is_roles_loading}
          className="shrink-0"
        >
          <Save className="h-4 w-4" />
          <span>Salvar</span>
        </Button>
      </div>

      {is_config_error && (
        <ErrorState
          title="Falha ao carregar configurações"
          description="Não foi possível carregar os dados do servidor."
          onAction={() => void refetch_config()}
        />
      )}

      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <div className="text-sm font-semibold">Cargos</div>
            <div className="mt-4">
              <div className="text-sm font-medium">Cargo de mute</div>
              <div className="mt-2">
                {is_roles_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select value={mute_role_id} onValueChange={(value) => set_mute_role_id(value)}>
                    <option value="">Desativado</option>
                    {available_roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Se configurado, o bot sincroniza automaticamente este cargo com o estado de timeout do usuário.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-accent/20">
        <CardContent className="p-6 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Nota:</span> Alterações podem levar alguns segundos para refletir no bot.
            </div>
            <div>
              <span className="font-semibold text-foreground">Dica:</span> Para obter IDs no Discord, ative o modo desenvolvedor e use “Copiar ID”.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
