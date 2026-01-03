import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Award, Save, Trash2, UserPlus, UserMinus } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge as UiBadge, Button, Card, CardContent, ErrorState, Input, Skeleton } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type badge_row = {
  id: string
  name: string
  description: string | null
  category: string
  icon: string | null
  hidden: boolean
}

export default function BadgesPage() {
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<badge_row | null>(null)
  const [grant_user_id, setGrantUserId] = useState('')
  const [grant_badge_id, setGrantBadgeId] = useState('')
  const [revoke_user_id, setRevokeUserId] = useState('')
  const [revoke_badge_id, setRevokeBadgeId] = useState('')

  const [holders_badge_id, setHoldersBadgeId] = useState('')

  const holders_query = useQuery({
    queryKey: ['badge_holders', holders_badge_id],
    enabled: holders_badge_id.trim().length > 0,
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/badges/${holders_badge_id}/holders?limit=200&offset=0`)
      return response.data as {
        success: boolean
        badge: badge_row
        holders: Array<{
          userId: string
          badgeId: string
          source: string
          grantedAt: string
          expiresAt: string | null
          user: { id: string; username: string | null; avatar: string | null }
        }>
        total: number
      }
    },
  })

  const {
    data: badges,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['badges'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/badges`)
      return (response.data as { success: boolean; badges: badge_row[] }).badges
    },
  })

  const revoke_from_list_mutation = useMutation({
    mutationFn: async ({ userId, badgeId }: { userId: string; badgeId: string }) => {
      await axios.post(`${API_URL}/api/badges/revoke`, { userId, badgeId })
    },
    onSuccess: async () => {
      toast_success('Badge removida!')
      await queryClient.invalidateQueries({ queryKey: ['badge_holders', holders_badge_id] })
    },
    onError: (error: unknown) => {
      const err = error as any
      toast_error(err?.response?.data?.error || err?.message || 'Erro ao remover badge')
    },
  })

  const upsert_mutation = useMutation({
    mutationFn: async (badge: badge_row) => {
      await axios.put(`${API_URL}/api/badges`, {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        icon: badge.icon,
        hidden: badge.hidden,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['badges'] })
      toast_success('Badge salva com sucesso!')
      setEditing(null)
    },
    onError: (error: unknown) => {
      const err = error as any
      toast_error(err?.response?.data?.error || err?.message || 'Erro ao salvar badge')
    },
  })

  const grant_mutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/badges/grant`, {
        userId: grant_user_id,
        badgeId: grant_badge_id,
        source: 'manual',
      })
    },
    onSuccess: () => {
      toast_success('Badge concedida!')
      setGrantUserId('')
      setGrantBadgeId('')
    },
    onError: (error: unknown) => {
      const err = error as any
      toast_error(err?.response?.data?.error || err?.message || 'Erro ao conceder badge')
    },
  })

  const revoke_mutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/badges/revoke`, {
        userId: revoke_user_id,
        badgeId: revoke_badge_id,
      })
    },
    onSuccess: () => {
      toast_success('Badge removida!')
      setRevokeUserId('')
      setRevokeBadgeId('')
    },
    onError: (error: unknown) => {
      const err = error as any
      toast_error(err?.response?.data?.error || err?.message || 'Erro ao remover badge')
    },
  })

  const grouped = useMemo(() => {
    const map = new Map<string, badge_row[]>()
    for (const b of badges ?? []) {
      const key = b.category || 'other'
      const list = map.get(key) ?? []
      list.push(b)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [badges])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <Award className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-xl font-semibold tracking-tight">Badges</div>
            <div className="text-sm text-muted-foreground">Catálogo e concessão manual</div>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-10">
          Atualizar
        </Button>
      </div>

      {isError && (
        <ErrorState title="Falha ao carregar badges" description="Não foi possível buscar /api/badges" />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 pt-6">
            <div className="text-sm font-medium">Catálogo</div>

            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {!isLoading && grouped.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhuma badge cadastrada.</div>
            )}

            {!isLoading && grouped.length > 0 && (
              <div className="space-y-6">
                {grouped.map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{category}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="flex items-start justify-between gap-3 rounded-2xl border border-border/80 bg-surface/40 px-4 py-3 text-left hover:bg-surface/60"
                          onClick={() => setEditing(b)}
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <UiBadge variant={b.hidden ? 'neutral' : 'accent'}>
                                {b.icon ? `${b.icon} ` : ''}{b.name}
                              </UiBadge>
                              <span className="min-w-0 truncate text-xs text-muted-foreground">{b.id}</span>
                            </div>
                            {b.description && (
                              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{b.description}</div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">Editar</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="text-sm font-medium">Criar/Editar</div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">ID</div>
                <Input value={editing?.id ?? ''} onChange={(e) => setEditing((prev) => ({
                  id: e.target.value,
                  name: prev?.name ?? '',
                  description: prev?.description ?? null,
                  category: prev?.category ?? 'community',
                  icon: prev?.icon ?? null,
                  hidden: prev?.hidden ?? false,
                }))} />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Nome</div>
                <Input value={editing?.name ?? ''} onChange={(e) => setEditing((prev) => ({
                  id: prev?.id ?? '',
                  name: e.target.value,
                  description: prev?.description ?? null,
                  category: prev?.category ?? 'community',
                  icon: prev?.icon ?? null,
                  hidden: prev?.hidden ?? false,
                }))} />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Categoria</div>
                <Input value={editing?.category ?? ''} onChange={(e) => setEditing((prev) => ({
                  id: prev?.id ?? '',
                  name: prev?.name ?? '',
                  description: prev?.description ?? null,
                  category: e.target.value,
                  icon: prev?.icon ?? null,
                  hidden: prev?.hidden ?? false,
                }))} />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Ícone (emoji/texto)</div>
                <Input value={editing?.icon ?? ''} onChange={(e) => setEditing((prev) => ({
                  id: prev?.id ?? '',
                  name: prev?.name ?? '',
                  description: prev?.description ?? null,
                  category: prev?.category ?? 'community',
                  icon: e.target.value || null,
                  hidden: prev?.hidden ?? false,
                }))} />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Descrição</div>
                <Input value={editing?.description ?? ''} onChange={(e) => setEditing((prev) => ({
                  id: prev?.id ?? '',
                  name: prev?.name ?? '',
                  description: e.target.value || null,
                  category: prev?.category ?? 'community',
                  icon: prev?.icon ?? null,
                  hidden: prev?.hidden ?? false,
                }))} />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const current = editing
                    if (!current || !current.id.trim() || !current.name.trim() || !current.category.trim()) {
                      toast_error('Preencha id, nome e categoria')
                      return
                    }
                    upsert_mutation.mutate(current)
                  }}
                  disabled={upsert_mutation.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)} className="h-10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="text-sm font-medium">Conceder</div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">User ID</div>
                <Input value={grant_user_id} onChange={(e) => setGrantUserId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Badge ID</div>
                <Input value={grant_badge_id} onChange={(e) => setGrantBadgeId(e.target.value)} />
              </div>
              <Button
                onClick={() => {
                  if (!grant_user_id.trim() || !grant_badge_id.trim()) {
                    toast_error('Preencha userId e badgeId')
                    return
                  }
                  grant_mutation.mutate()
                }}
                disabled={grant_mutation.isPending}
                className="w-full"
              >
                <UserPlus className="h-4 w-4" />
                Conceder
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="text-sm font-medium">Remover</div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">User ID</div>
                <Input value={revoke_user_id} onChange={(e) => setRevokeUserId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Badge ID</div>
                <Input value={revoke_badge_id} onChange={(e) => setRevokeBadgeId(e.target.value)} />
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!revoke_user_id.trim() || !revoke_badge_id.trim()) {
                    toast_error('Preencha userId e badgeId')
                    return
                  }
                  revoke_mutation.mutate()
                }}
                disabled={revoke_mutation.isPending}
                className="w-full"
              >
                <UserMinus className="h-4 w-4" />
                Remover
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="text-sm font-medium">Quem tem a badge (admin)</div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Badge ID</div>
                <Input value={holders_badge_id} onChange={(e) => setHoldersBadgeId(e.target.value)} />
              </div>

              {holders_query.isError && (
                <ErrorState
                  title="Falha ao carregar holders"
                  description="Você precisa estar em BADGE_ADMIN_USER_IDS"
                />
              )}

              {holders_query.isLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}

              {!holders_query.isLoading && holders_query.data && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Total: {holders_query.data.total}
                  </div>
                  {holders_query.data.holders.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Ninguém possui essa badge.</div>
                  ) : (
                    <div className="max-h-[320px] space-y-2 overflow-auto">
                      {holders_query.data.holders.map((h) => (
                        <div
                          key={`${h.userId}:${h.badgeId}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/40 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{h.user.username ?? h.user.id}</div>
                            <div className="truncate text-xs text-muted-foreground">{h.userId}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={revoke_from_list_mutation.isPending}
                            onClick={() => revoke_from_list_mutation.mutate({ userId: h.userId, badgeId: h.badgeId })}
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
