import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Trash2, UserPlus } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Input, Select, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type api_role = {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
}

type autorole_config = {
  enabled: boolean
  delaySeconds: number
  onlyAfterFirstMessage: boolean
  roleIds: string[]
}

export default function AutorolePage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()
  const has_initialized = useRef(false)

  const [config, setConfig] = useState<autorole_config | null>(null)
  const [new_role_id, setNewRoleId] = useState('')

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
    data: autorole_data,
    isLoading: is_autorole_loading,
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

  useEffect(() => {
    if (!autorole_data) return
    if (has_initialized.current) return
    has_initialized.current = true

    setConfig({
      enabled: autorole_data.config.enabled ?? false,
      delaySeconds: autorole_data.config.delaySeconds ?? 0,
      onlyAfterFirstMessage: autorole_data.config.onlyAfterFirstMessage ?? false,
      roleIds: autorole_data.roleIds ?? [],
    })
  }, [autorole_data])

  const mutation = useMutation({
    mutationFn: async (data: autorole_config) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/autorole-config`, {
        enabled: data.enabled,
        delaySeconds: data.delaySeconds,
        onlyAfterFirstMessage: data.onlyAfterFirstMessage,
        roleIds: data.roleIds,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autorole-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const roles = roles_data?.roles ?? []
  const available_roles = roles
    .filter((r) => !r.managed)
    .sort((a, b) => b.position - a.position)
  const role_by_id = new Map(available_roles.map((r) => [r.id, r] as const))

  const handle_save = () => {
    if (!config) return
    mutation.mutate(config)
  }

  const add_role = () => {
    if (!config) return
    if (!new_role_id) return
    if (config.roleIds.includes(new_role_id)) return
    if (config.roleIds.length >= 20) return

    setConfig({ ...config, roleIds: [...config.roleIds, new_role_id] })
    setNewRoleId('')
  }

  const remove_role = (role_id: string) => {
    if (!config) return
    setConfig({ ...config, roleIds: config.roleIds.filter((id) => id !== role_id) })
  }

  const is_loading = is_roles_loading || is_autorole_loading
  const is_error = is_roles_error || is_autorole_error

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Autorole</div>
            <div className="text-sm text-muted-foreground">Cargos automáticos para novos membros</div>
          </div>
        </div>

        <Button onClick={handle_save} isLoading={mutation.isPending} className="shrink-0" disabled={!config || is_loading}>
          <Save className="h-4 w-4" />
          <span>Salvar</span>
        </Button>
      </div>

      {is_error && (
        <ErrorState
          title="Erro ao carregar autorole"
          description="Não foi possível buscar as configurações do autorole."
          actionLabel="Tentar novamente"
          onAction={() => {
            refetch_autorole()
            refetch_roles()
          }}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Ativar autorole</div>
              <div className="text-xs text-muted-foreground">Dê cargos automaticamente para novos membros.</div>
            </div>

            <Switch
              checked={Boolean(config?.enabled)}
              onCheckedChange={(checked) => config && setConfig({ ...config, enabled: checked })}
              label="Autorole habilitado"
              disabled={is_loading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="text-sm font-semibold">Regras</div>

          {is_loading || !config ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Aguardar (segundos)</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Tempo para aplicar os cargos após o membro entrar no servidor.
                </div>
                <div className="mt-2">
                  <Input
                    value={String(config.delaySeconds)}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value || '0', 10)
                      setConfig({ ...config, delaySeconds: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) })
                    }}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-surface/30 p-4">
                <div>
                  <div className="text-sm font-medium">Somente após primeira mensagem</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Útil para evitar problemas com nível de verificação do Discord.
                  </div>
                </div>

                <Switch
                  checked={config.onlyAfterFirstMessage}
                  onCheckedChange={(checked) => setConfig({ ...config, onlyAfterFirstMessage: checked })}
                  label="Após mensagem"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-sm font-semibold">Cargos</div>
            <div className="mt-1 text-xs text-muted-foreground">Selecione até 20 cargos para serem dados automaticamente.</div>
          </div>

          {is_loading || !config ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <Select value={new_role_id} onValueChange={(value) => setNewRoleId(value)}>
                  <option value="">Selecione um cargo</option>
                  {available_roles
                    .filter((r) => !config.roleIds.includes(r.id))
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </Select>

                <Button variant="outline" onClick={add_role} disabled={!new_role_id}>
                  <span>Adicionar</span>
                </Button>
              </div>

              {config.roleIds.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum cargo configurado.</div>
              ) : (
                <div className="space-y-2">
                  {config.roleIds
                    .slice()
                    .sort((a, b) => (role_by_id.get(b)?.position ?? 0) - (role_by_id.get(a)?.position ?? 0))
                    .map((role_id) => {
                      const role = role_by_id.get(role_id)

                      return (
                        <div
                          key={role_id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface/40 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{role?.name ?? `Cargo ${role_id}`}</div>
                            <div className="text-xs text-muted-foreground">{role_id}</div>
                          </div>

                          <Button variant="outline" size="sm" className="h-9 w-9 px-0" onClick={() => remove_role(role_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
