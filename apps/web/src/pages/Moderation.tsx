import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Plus, Save, X } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, ErrorState, Select, Skeleton } from '../components/ui'
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
  muteRoleIds?: string[]
}

type automod_config_response = {
  success: boolean
  config: {
    muteRoleId: string | null
    muteRoleIds?: string[]
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

  const [mute_role_ids, set_mute_role_ids] = useState<string[]>([])
  const [mute_role_picker, set_mute_role_picker] = useState('')
  const has_initialized = useRef(false)

  useEffect(() => {
    if (!config) return
    if (has_initialized.current) return
    has_initialized.current = true

    const initial_ids = (config.muteRoleIds ?? []).filter(Boolean)
    if (initial_ids.length > 0) {
      set_mute_role_ids(initial_ids)
      return
    }

    const legacy = config.muteRoleId ?? ''
    set_mute_role_ids(legacy ? [legacy] : [])
  }, [config])

  const mute_roles = useMemo(() => {
    const by_id = new Map(available_roles.map((r) => [r.id, r]))
    return mute_role_ids
      .map((id) => by_id.get(id))
      .filter((r): r is api_role => Boolean(r))
  }, [available_roles, mute_role_ids])

  const add_mute_role = (role_id: string) => {
    const trimmed = role_id.trim()
    if (!trimmed) return
    set_mute_role_ids((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    set_mute_role_picker('')
  }

  const remove_mute_role = (role_id: string) => {
    set_mute_role_ids((prev) => prev.filter((id) => id !== role_id))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/automod-config`, {
        muteRoleIds: mute_role_ids,
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
              <div className="text-sm font-medium">Cargos de mute</div>
              <div className="mt-2">
                {is_roles_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {mute_role_ids.length === 0 ? (
                        <Badge>Desativado</Badge>
                      ) : (
                        mute_roles.map((role) => (
                          <Badge key={role.id} className="flex items-center gap-2">
                            <span>{role.name}</span>
                            <button
                              type="button"
                              onClick={() => remove_mute_role(role.id)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={`Remover ${role.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Select value={mute_role_picker} onValueChange={(value) => set_mute_role_picker(value)}>
                        <option value="">Selecionar cargo</option>
                        {available_roles
                          .filter((r) => !mute_role_ids.includes(r.id))
                          .map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!mute_role_picker}
                        onClick={() => add_mute_role(mute_role_picker)}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Adicionar</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Se configurado, o bot sincroniza automaticamente estes cargos com o estado de timeout do usuário.
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
