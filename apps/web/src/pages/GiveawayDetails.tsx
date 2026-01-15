import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { ArrowLeft, Trophy, Calendar, Users, CheckCircle, Download } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Skeleton } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

interface GiveawayEntry {
  id: string
  userId: string
  username: string
  avatar: string | null
  choices: string[] | null
  disqualified: boolean
  createdAt: string
}

interface GiveawayWinner {
  id: string
  userId: string
  username: string
  prize: string | null
  prizeIndex: number | null
  createdAt: string
}

interface Giveaway {
  id: string
  title: string
  description: string
  channelId: string
  messageId: string | null
  maxWinners: number
  format: string
  availableItems: string[] | null
  minChoices: number | null
  maxChoices: number | null
  endsAt: string
  ended: boolean
  cancelled: boolean
  suspended?: boolean
  requiredRoleId?: string | null
  requiredRoleIds?: string[] | null
  roleChances?: {roleId: string, multiplier: number}[] | null
  createdAt: string
  entries: GiveawayEntry[]
  winners: GiveawayWinner[]
}

export default function GiveawayDetailsPage() {
  const { guildId, giveawayId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [show_items, setShowItems] = useState(false)

  const {
    data,
    isLoading,
    isError,
    refetch,
    error,
  } = useQuery({
    queryKey: ['giveaway', guildId, giveawayId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/giveaways/${giveawayId}`)
      return response.data as { success: boolean; giveaway: Giveaway }
    },
  })

  const giveaway = data?.giveaway

  const status_label = useMemo(() => {
    if (!giveaway) return ''
    if (giveaway.cancelled) return 'Cancelado'
    if (giveaway.ended) return 'Finalizado'
    if (giveaway.suspended) return 'Suspenso'
    return 'Ativo'
  }, [giveaway])

  const status_style = useMemo(() => {
    if (!giveaway) return ''
    if (giveaway.cancelled || giveaway.ended) return 'text-muted-foreground'
    if (giveaway.suspended) return 'text-yellow-300'
    return 'text-accent'
  }, [giveaway])

  const required_roles = useMemo(() => {
    if (!giveaway) return [] as string[]
    if (Array.isArray(giveaway.requiredRoleIds) && giveaway.requiredRoleIds.length > 0) return giveaway.requiredRoleIds
    if (typeof giveaway.requiredRoleId === 'string' && giveaway.requiredRoleId) return [giveaway.requiredRoleId]
    return []
  }, [giveaway])

  const cancel_mutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/giveaways/${giveawayId}/cancel`)
    },
    onSuccess: async () => {
      toast_success('Sorteio cancelado.')
      await queryClient.invalidateQueries({ queryKey: ['giveaway', guildId, giveawayId] })
      await queryClient.invalidateQueries({ queryKey: ['giveaways', guildId] })
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao cancelar sorteio')
    },
  })

  const suspend_mutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/giveaways/${giveawayId}/suspend`)
    },
    onSuccess: async () => {
      toast_success('Sorteio suspenso.')
      await queryClient.invalidateQueries({ queryKey: ['giveaway', guildId, giveawayId] })
      await queryClient.invalidateQueries({ queryKey: ['giveaways', guildId] })
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao suspender sorteio')
    },
  })

  const resume_mutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/giveaways/${giveawayId}/resume`)
    },
    onSuccess: async () => {
      toast_success('Sorteio retomado.')
      await queryClient.invalidateQueries({ queryKey: ['giveaway', guildId, giveawayId] })
      await queryClient.invalidateQueries({ queryKey: ['giveaways', guildId] })
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao retomar sorteio')
    },
  })

  const end_mutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/giveaways/${giveawayId}/end`)
    },
    onSuccess: async () => {
      toast_success('Sorteio marcado para finalizar. O bot vai anunciar em instantes.')
      await queryClient.invalidateQueries({ queryKey: ['giveaway', guildId, giveawayId] })
      await queryClient.invalidateQueries({ queryKey: ['giveaways', guildId] })
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao finalizar sorteio')
    },
  })

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/guild/${guildId}/giveaways`)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>

          <div>
            <div className="text-xl font-semibold tracking-tight">Sorteio</div>
            <div className="text-sm text-muted-foreground">Detalhes</div>
          </div>
        </div>

        {giveaway && (
          <div className="flex items-center gap-2">
            <a
              href={`${API_URL}/api/guilds/${guildId}/giveaways/${giveawayId}/export?format=json`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-surface/50 px-4 text-sm text-muted-foreground hover:bg-surface/70 hover:text-foreground"
              download
            >
              <Download className="h-4 w-4" />
              JSON
            </a>
            <a
              href={`${API_URL}/api/guilds/${guildId}/giveaways/${giveawayId}/export?format=csv`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-surface/50 px-4 text-sm text-muted-foreground hover:bg-surface/70 hover:text-foreground"
              download
            >
              <Download className="h-4 w-4" />
              CSV
            </a>
          </div>
        )}
      </div>

      {isError ? (
        <ErrorState
          title="Erro ao carregar sorteio"
          description={(error as any)?.response?.data?.error || 'Não foi possível buscar os detalhes do sorteio.'}
          onAction={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : !giveaway ? (
        <EmptyState title="Sorteio não encontrado" description="Verifique se o ID é válido." />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-2xl font-semibold tracking-tight">{giveaway.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{giveaway.description}</div>
                </div>
                <div className="shrink-0">
                  {giveaway.ended || giveaway.cancelled ? (
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
                      {giveaway.cancelled ? 'Cancelado' : 'Finalizado'}
                    </span>
                  ) : giveaway.suspended ? (
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/60 px-3 py-1 text-xs text-yellow-300">
                      Suspenso
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
                      Ativo
                    </span>
                  )}
                </div>
              </div>

              {!giveaway.ended && !giveaway.cancelled && (
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm('Finalizar este sorteio agora? O bot irá apurar e anunciar os vencedores.')) return
                      end_mutation.mutate()
                    }}
                    isLoading={end_mutation.isPending}
                  >
                    Finalizar
                  </Button>

                  {giveaway.suspended ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!window.confirm('Retomar este sorteio?')) return
                        resume_mutation.mutate()
                      }}
                      isLoading={resume_mutation.isPending}
                    >
                      Retomar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!window.confirm('Suspender este sorteio? Novas participações serão bloqueadas.')) return
                        suspend_mutation.mutate()
                      }}
                      isLoading={suspend_mutation.isPending}
                    >
                      Suspender
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm('Cancelar este sorteio? Esta ação encerra o sorteio.')) return
                      cancel_mutation.mutate()
                    }}
                    isLoading={cancel_mutation.isPending}
                  >
                    Cancelar
                  </Button>

                  <div className={`text-xs ${status_style}`}>Status: {status_label}</div>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    <span>Vencedores</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{giveaway.maxWinners}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Participantes</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{giveaway.entries.length}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Termina</span>
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {new Date(giveaway.endsAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-4 w-4" />
                    <span>Formato</span>
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {giveaway.format === 'list' ? 'Lista' : 'Reação'}
                  </div>
                </div>
              </div>

              {giveaway.roleChances && giveaway.roleChances.length > 0 && (
                <div className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-4">
                  <div className="text-sm font-semibold">Chances por cargo</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Usuários com estes cargos têm mais chances de ganhar
                  </div>

                  <div className="mt-4 space-y-3">
                    {giveaway.roleChances.map((chance) => (
                      <div key={chance.roleId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {chance.roleId}
                          </div>
                        </div>
                        <div className="text-sm font-medium">
                          {chance.multiplier}x chances
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {giveaway.format === 'list' && giveaway.availableItems && (
                <div className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-4">
                  <div className="text-sm font-semibold">Itens disponíveis ({giveaway.availableItems.length})</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Min: {giveaway.minChoices} • Max: {giveaway.maxChoices}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => setShowItems((prev) => !prev)}
                    >
                      {show_items ? 'Ocultar lista' : 'Ver lista completa'}
                    </Button>
                  </div>

                  {show_items && (
                    <div className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-border/70 bg-surface/60 p-3">
                      <ol className="space-y-1 text-sm text-muted-foreground">
                        {giveaway.availableItems
                          .slice() // Create a copy to avoid mutating original array
                          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'pt-BR'))
                          .map((item, idx) => (
                            <li key={`${idx}-${item}`} className="flex items-start gap-2">
                              <span className="text-accent">{idx + 1}.</span>
                              <span className="text-foreground">{item}</span>
                            </li>
                          ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {required_roles.length > 0 && (
                <div className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-4">
                  <div className="text-sm font-semibold">Cargos obrigatórios</div>
                  <div className="mt-2 text-xs text-muted-foreground">O participante precisa ter pelo menos 1 deles.</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {required_roles.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center rounded-full border border-border/70 bg-surface/70 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {giveaway.winners.length > 0 && (
            <Card className="border-accent/20">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-accent" />
                  <div className="text-sm font-semibold">Vencedores ({giveaway.winners.length})</div>
                </div>

                <div className="space-y-2">
                  {giveaway.winners.map((winner, index) => (
                    <div key={winner.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/40 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{winner.username}</div>
                        {winner.prize && <div className="mt-1 text-xs text-muted-foreground">Prêmio: {winner.prize}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground">#{index + 1}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                <div className="text-sm font-semibold">
                  Participantes ({giveaway.entries.filter((e) => !e.disqualified).length})
                </div>
              </div>

              {giveaway.entries.length === 0 ? (
                <EmptyState title="Nenhum participante" description="Ainda não houve entradas neste sorteio." />
              ) : (
                <div className="space-y-2">
                  {giveaway.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={
                        entry.disqualified
                          ? 'rounded-2xl border border-border/70 bg-surface/40 px-4 py-3 opacity-60'
                          : 'rounded-2xl border border-border/70 bg-surface/40 px-4 py-3'
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold">{entry.username}</div>
                            {entry.disqualified && (
                              <span className="rounded-full border border-border/70 bg-surface/70 px-2 py-1 text-[11px] text-muted-foreground">
                                Desqualificado
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString('pt-BR')}
                          </div>
                        </div>

                        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                          {entry.username.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      {entry.choices && entry.choices.length > 0 && (
                        <div className="mt-3 rounded-xl border border-border/70 bg-surface/60 p-3">
                          <div className="text-xs font-semibold text-muted-foreground">Escolhas</div>
                          <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {entry.choices.map((choice, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-accent">{idx + 1}.</span>
                                <span className="text-foreground">{choice}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
