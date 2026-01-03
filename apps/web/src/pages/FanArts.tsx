import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Image as ImageIcon, RefreshCcw, Check, X } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, ErrorState, Input, Skeleton } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type fanart_row = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  imageUrl: string
  imageName: string | null
  imageSize: number | null
  title: string | null
  description: string | null
  tags: unknown | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  user: {
    id: string
    username: string | null
    avatar: string | null
  }
}

export default function FanArtsPage() {
  const queryClient = useQueryClient()

  const [review_note, setReviewNote] = useState('')
  const [selected_id, setSelectedId] = useState<string | null>(null)

  const approved_query = useQuery({
    queryKey: ['fanarts', 'approved'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/fanarts?limit=60&offset=0`)
      return response.data as { success: boolean; fanArts: fanart_row[]; total: number }
    },
  })

  const pending_query = useQuery({
    queryKey: ['fanarts', 'pending'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/fanarts/pending?limit=60&offset=0`)
      return response.data as { success: boolean; fanArts: fanart_row[]; total: number }
    },
  })

  const approve_mutation = useMutation({
    mutationFn: async (fanArtId: string) => {
      await axios.post(`${API_URL}/api/fanarts/${fanArtId}/review`, {
        status: 'approved',
        reviewNote: review_note || null,
      })
    },
    onSuccess: async () => {
      toast_success('Fan art aprovada!')
      setReviewNote('')
      setSelectedId(null)
      await queryClient.invalidateQueries({ queryKey: ['fanarts'] })
    },
    onError: (error: unknown) => {
      const err = error as any
      toast_error(err?.response?.data?.details || err?.response?.data?.error || err?.message || 'Erro ao aprovar')
    },
  })

  const reject_mutation = useMutation({
    mutationFn: async (fanArtId: string) => {
      await axios.post(`${API_URL}/api/fanarts/${fanArtId}/review`, {
        status: 'rejected',
        reviewNote: review_note || null,
      })
    },
    onSuccess: async () => {
      toast_success('Fan art rejeitada!')
      setReviewNote('')
      setSelectedId(null)
      await queryClient.invalidateQueries({ queryKey: ['fanarts'] })
    },
    onError: (error: unknown) => {
      const err = error as any
      toast_error(err?.response?.data?.details || err?.response?.data?.error || err?.message || 'Erro ao rejeitar')
    },
  })

  const approved = approved_query.data?.fanArts ?? []
  const pending = pending_query.data?.fanArts ?? []

  const selected = useMemo(() => {
    if (!selected_id) return null
    return pending.find((p) => p.id === selected_id) ?? null
  }, [pending, selected_id])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <ImageIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Fan Arts</div>
            <div className="mt-1 text-sm text-muted-foreground">Galeria e fila de aprovação</div>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={() => {
            approved_query.refetch()
            pending_query.refetch()
          }}
          className="h-10"
        >
          <RefreshCcw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {(approved_query.isError || pending_query.isError) && (
        <ErrorState
          title="Falha ao carregar fan arts"
          description="Verifique sua sessão e se você está na allowlist FAN_ART_REVIEWER_USER_IDS para ver pendentes."
          onAction={() => {
            approved_query.refetch()
            pending_query.refetch()
          }}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 pt-6">
            <div className="text-sm font-medium">Aprovadas</div>

            {approved_query.isLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 w-full" />
                ))}
              </div>
            ) : approved.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma fan art aprovada ainda.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {approved.map((fa) => (
                  <a
                    key={fa.id}
                    href={fa.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-2xl border border-border/80 bg-surface/40 hover:bg-surface/60"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-black/10">
                      <img
                        src={fa.imageUrl}
                        alt={fa.title ?? fa.id}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    </div>
                    <div className="space-y-1 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{fa.title ?? 'Sem título'}</div>
                        <Badge variant="accent">approved</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{fa.user.username ?? fa.user.id}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="text-sm font-medium">Pendentes (staff)</div>

              {pending_query.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : pending.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma pendente.</div>
              ) : (
                <div className="space-y-2">
                  {pending.map((fa) => (
                    <button
                      key={fa.id}
                      type="button"
                      onClick={() => setSelectedId(fa.id)}
                      className={
                        'w-full rounded-2xl border px-4 py-3 text-left transition-colors ' +
                        (selected_id === fa.id
                          ? 'border-accent/50 bg-surface/70'
                          : 'border-border/80 bg-surface/40 hover:bg-surface/60')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{fa.title ?? 'Sem título'}</div>
                          <div className="truncate text-xs text-muted-foreground">{fa.user.username ?? fa.user.id}</div>
                        </div>
                        <Badge variant="neutral">pending</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="text-sm font-medium">Revisão</div>

              {!selected ? (
                <div className="text-sm text-muted-foreground">Selecione uma pendente acima.</div>
              ) : (
                <div className="space-y-3">
                  <a
                    href={selected.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-2xl border border-border/80 bg-surface/40"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-black/10">
                      <img src={selected.imageUrl} alt={selected.title ?? selected.id} className="h-full w-full object-cover" />
                    </div>
                  </a>

                  <div className="text-xs text-muted-foreground">ID: {selected.id}</div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Nota (opcional)</div>
                    <Input value={review_note} onChange={(e) => setReviewNote(e.target.value)} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => approve_mutation.mutate(selected.id)}
                      disabled={approve_mutation.isPending || reject_mutation.isPending}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => reject_mutation.mutate(selected.id)}
                      disabled={approve_mutation.isPending || reject_mutation.isPending}
                      className="flex-1"
                    >
                      <X className="h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
