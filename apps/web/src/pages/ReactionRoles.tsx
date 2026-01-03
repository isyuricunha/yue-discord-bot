import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Trash2, Wand2 } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Input, Select, Skeleton, Switch } from '../components/ui'
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

type reaction_role_item = {
  roleId: string
  label: string | null
  emoji: string | null
}

type reaction_role_panel = {
  id: string
  name: string
  enabled: boolean
  mode: 'single' | 'multiple' | string
  channelId: string | null
  messageId: string | null
  itemsCount: number
  createdAt: string
  updatedAt: string
}

type reaction_role_panel_details = {
  id: string
  guildId: string
  name: string
  enabled: boolean
  mode: 'single' | 'multiple' | string
  channelId: string | null
  messageId: string | null
  items: Array<{ id: string; roleId: string; label: string | null; emoji: string | null; createdAt: string }>
  createdAt: string
  updatedAt: string
}

function channel_label(ch: api_channel) {
  return `#${ch.name}`
}

const CHANNEL_TYPE_GUILD_TEXT = 0
const CHANNEL_TYPE_GUILD_ANNOUNCEMENT = 5

export default function ReactionRolesPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const [selected_panel_id, set_selected_panel_id] = useState<string>('')
  const [editor, set_editor] = useState<{
    name: string
    enabled: boolean
    mode: 'single' | 'multiple'
    items: reaction_role_item[]
  } | null>(null)

  const has_initialized_panel = useRef(false)

  const {
    data: channels_data,
    isLoading: is_channels_loading,
    isError: is_channels_error,
    refetch: refetch_channels,
  } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return res.data as { channels: api_channel[] }
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
      return res.data as { roles: api_role[] }
    },
  })

  const {
    data: panels_data,
    isLoading: is_panels_loading,
    isError: is_panels_error,
    refetch: refetch_panels,
  } = useQuery({
    queryKey: ['reaction-roles-panels', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/reaction-roles/panels`)
      return res.data as { success: boolean; panels: reaction_role_panel[] }
    },
  })

  const {
    data: panel_details_data,
    isLoading: is_panel_loading,
    isError: is_panel_error,
    refetch: refetch_panel,
  } = useQuery({
    queryKey: ['reaction-roles-panel', guildId, selected_panel_id],
    enabled: Boolean(selected_panel_id),
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/reaction-roles/panels/${selected_panel_id}`)
      return res.data as { success: boolean; panel: reaction_role_panel_details }
    },
  })

  useEffect(() => {
    if (!selected_panel_id) {
      has_initialized_panel.current = false
      set_editor(null)
      return
    }

    if (!panel_details_data?.panel) return
    if (has_initialized_panel.current) return
    has_initialized_panel.current = true

    const p = panel_details_data.panel
    set_editor({
      name: p.name,
      enabled: p.enabled,
      mode: p.mode === 'single' ? 'single' : 'multiple',
      items: p.items.map((i) => ({ roleId: i.roleId, label: i.label ?? null, emoji: i.emoji ?? null })),
    })
  }, [panel_details_data, selected_panel_id])

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
    .slice()
    .sort((a, b) => b.position - a.position)

  const role_by_id = useMemo(() => new Map(available_roles.map((r) => [r.id, r] as const)), [available_roles])

  const panels = panels_data?.panels ?? []
  const selected_panel = panel_details_data?.panel

  useEffect(() => {
    if (!selected_panel_id) return
    if (!selected_panel) return
    set_publish_channel_id(selected_panel.channelId ?? '')
  }, [selected_panel_id, selected_panel?.channelId])

  const create_mutation = useMutation({
    mutationFn: async () => {
      const available = (roles_data?.roles ?? [])
        .filter((r) => !r.managed)
        .slice()
        .sort((a, b) => b.position - a.position)

      const first_role_id = available[0]?.id
      if (!first_role_id) {
        throw new Error('No available roles')
      }

      const res = await axios.post(`${API_URL}/api/guilds/${guildId}/reaction-roles/panels`, {
        name: 'Novo painel',
        enabled: true,
        mode: 'multiple',
        items: [{ roleId: first_role_id }],
      })

      return res.data as { success: boolean; panelId: string }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['reaction-roles-panels', guildId] })
      if (data?.panelId) {
        set_selected_panel_id(data.panelId)
        has_initialized_panel.current = false
      }
      toast_success('Painel criado!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao criar painel')
    },
  })

  const save_mutation = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error('Missing editor')
      if (!selected_panel_id) throw new Error('Missing panelId')

      await axios.put(`${API_URL}/api/guilds/${guildId}/reaction-roles/panels/${selected_panel_id}`, {
        name: editor.name,
        enabled: editor.enabled,
        mode: editor.mode,
        items: editor.items.map((i) => ({ roleId: i.roleId, label: i.label, emoji: i.emoji })),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reaction-roles-panels', guildId] })
      await queryClient.invalidateQueries({ queryKey: ['reaction-roles-panel', guildId, selected_panel_id] })
      toast_success('Painel salvo!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar painel')
    },
  })

  const delete_mutation = useMutation({
    mutationFn: async () => {
      if (!selected_panel_id) throw new Error('Missing panelId')
      await axios.delete(`${API_URL}/api/guilds/${guildId}/reaction-roles/panels/${selected_panel_id}`)
    },
    onSuccess: async () => {
      set_selected_panel_id('')
      has_initialized_panel.current = false
      set_editor(null)
      await queryClient.invalidateQueries({ queryKey: ['reaction-roles-panels', guildId] })
      toast_success('Painel removido!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao remover painel')
    },
  })

  const publish_mutation = useMutation({
    mutationFn: async (channel_id: string) => {
      if (!selected_panel_id) throw new Error('Missing panelId')
      const res = await axios.post(`${API_URL}/api/guilds/${guildId}/reaction-roles/panels/${selected_panel_id}/publish`, {
        channelId: channel_id,
      })
      return res.data as { success: boolean; messageId: string }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reaction-roles-panels', guildId] })
      await queryClient.invalidateQueries({ queryKey: ['reaction-roles-panel', guildId, selected_panel_id] })
      toast_success('Painel publicado!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao publicar painel')
    },
  })

  const [publish_channel_id, set_publish_channel_id] = useState<string>('')

  const add_item = () => {
    if (!editor) return

    const first_role = available_roles.find((r) => !editor.items.some((i) => i.roleId === r.id))
    if (!first_role) return

    set_editor({
      ...editor,
      items: [...editor.items, { roleId: first_role.id, label: null, emoji: null }].slice(0, 25),
    })
  }

  const remove_item = (index: number) => {
    if (!editor) return
    set_editor({ ...editor, items: editor.items.filter((_, i) => i !== index) })
  }

  const update_item = (index: number, patch: Partial<reaction_role_item>) => {
    if (!editor) return

    if (patch.roleId) {
      const normalized = patch.roleId.trim()
      if (!normalized) return
      const already_used = editor.items.some((it, i) => i !== index && it.roleId === normalized)
      if (already_used) return
      patch = { ...patch, roleId: normalized }
    }

    set_editor({
      ...editor,
      items: editor.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    })
  }

  const is_loading = is_channels_loading || is_roles_loading || is_panels_loading || is_panel_loading
  const is_error = is_channels_error || is_roles_error || is_panels_error || is_panel_error

  const can_save = Boolean(
    editor &&
      selected_panel_id &&
      editor.name.trim().length > 0 &&
      editor.items.length > 0 &&
      editor.items.every((i) => typeof i.roleId === 'string' && i.roleId.trim().length > 0) &&
      new Set(editor.items.map((i) => i.roleId)).size === editor.items.length
  )
  const can_publish = Boolean(selected_panel_id && publish_channel_id)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <Wand2 className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Reaction Roles</div>
            <div className="text-sm text-muted-foreground">Crie painéis de cargos com botões</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => create_mutation.mutate()} isLoading={create_mutation.isPending} disabled={is_loading}>
            <span>Novo painel</span>
          </Button>

          <Button type="button" onClick={() => save_mutation.mutate()} isLoading={save_mutation.isPending} disabled={!can_save || is_loading}>
            <Save className="h-4 w-4" />
            <span>Salvar</span>
          </Button>
        </div>
      </div>

      {is_error && (
        <ErrorState
          title="Erro ao carregar reaction roles"
          description="Não foi possível carregar canais/roles/painéis."
          actionLabel="Tentar novamente"
          onAction={() => {
            refetch_channels()
            refetch_roles()
            refetch_panels()
            refetch_panel()
          }}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold">Painéis</div>
              <div className="mt-1 text-xs text-muted-foreground">Selecione um painel para editar.</div>

              <div className="mt-2">
                {is_panels_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select value={selected_panel_id} onValueChange={(v) => {
                    set_selected_panel_id(v)
                    has_initialized_panel.current = false
                  }}>
                    <option value="">Selecione um painel</option>
                    {panels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.itemsCount})
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {selected_panel_id && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{selected_panel?.name ?? 'Painel'}</div>
                    <div className="mt-1 text-xs text-muted-foreground font-mono">{selected_panel_id}</div>
                  </div>

                  <Button type="button" variant="ghost" size="sm" onClick={() => delete_mutation.mutate()} isLoading={delete_mutation.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold">Publicar</div>
              <div className="mt-1 text-xs text-muted-foreground">Envia/atualiza a mensagem do painel no Discord.</div>

              <div className="mt-2 space-y-2">
                {is_channels_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select value={publish_channel_id} onValueChange={set_publish_channel_id}>
                    <option value="">Selecione um canal</option>
                    {text_channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {channel_label(ch)}
                      </option>
                    ))}
                  </Select>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => publish_mutation.mutate(publish_channel_id)}
                  isLoading={publish_mutation.isPending}
                  disabled={!can_publish || is_loading}
                >
                  <span>Publicar</span>
                </Button>

                <div className="rounded-2xl border border-border/70 bg-surface/30 p-4 text-sm">
                  <div>
                    Canal: {selected_panel?.channelId ? <span className="font-mono">{selected_panel.channelId}</span> : '—'}
                  </div>
                  <div className="mt-1">
                    Mensagem: {selected_panel?.messageId ? <span className="font-mono">{selected_panel.messageId}</span> : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Editor</div>
              <div className="mt-1 text-xs text-muted-foreground">Configurações do painel e itens.</div>
            </div>

            {editor && (
              <Switch checked={editor.enabled} onCheckedChange={(checked) => set_editor({ ...editor, enabled: checked })} label="Painel ativo" />
            )}
          </div>

          {is_panel_loading && selected_panel_id ? (
            <Skeleton className="h-32 w-full" />
          ) : !selected_panel_id ? (
            <div className="text-sm text-muted-foreground">Selecione um painel para editar.</div>
          ) : !editor ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium">Nome</div>
                  <div className="mt-2">
                    <Input value={editor.name} onChange={(e) => set_editor({ ...editor, name: e.target.value })} placeholder="Nome do painel" />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Modo</div>
                  <div className="mt-2">
                    <Select value={editor.mode} onValueChange={(v) => set_editor({ ...editor, mode: v === 'single' ? 'single' : 'multiple' })}>
                      <option value="multiple">Múltipla seleção</option>
                      <option value="single">Seleção única</option>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Itens</div>
                    <div className="mt-1 text-xs text-muted-foreground">Até 25 cargos.</div>
                  </div>

                  <Button type="button" variant="outline" onClick={add_item} disabled={editor.items.length >= 25 || available_roles.length === 0}>
                    <span>Adicionar item</span>
                  </Button>
                </div>

                {editor.items.length === 0 ? (
                  <div className="mt-2 text-sm text-muted-foreground">Nenhum item configurado.</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {editor.items.map((it, idx) => {
                      const role = role_by_id.get(it.roleId)
                      return (
                        <div key={`${it.roleId}-${idx}`} className="grid grid-cols-1 gap-2 rounded-2xl border border-border/70 bg-surface/30 p-4 md:grid-cols-12 md:items-center">
                          <div className="md:col-span-5">
                            <div className="text-xs text-muted-foreground">Cargo</div>
                            <Select value={it.roleId} onValueChange={(v) => update_item(idx, { roleId: v })}>
                              <option value="">Selecione um cargo</option>
                              {available_roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </Select>
                            <div className="mt-1 text-xs text-muted-foreground font-mono">{role?.id ?? it.roleId}</div>
                          </div>

                          <div className="md:col-span-4">
                            <div className="text-xs text-muted-foreground">Label (opcional)</div>
                            <Input
                              value={it.label ?? ''}
                              onChange={(e) => update_item(idx, { label: e.target.value ? e.target.value : null })}
                              placeholder={role?.name ?? 'Label'}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <div className="text-xs text-muted-foreground">Emoji (opcional)</div>
                            <Input value={it.emoji ?? ''} onChange={(e) => update_item(idx, { emoji: e.target.value ? e.target.value : null })} placeholder="😀" />
                          </div>

                          <div className="flex justify-end md:col-span-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => remove_item(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
