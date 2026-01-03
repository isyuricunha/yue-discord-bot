import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Trophy, Calendar, Users, CheckCircle, Download } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Skeleton } from '../components/ui'

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
  createdAt: string
  entries: GiveawayEntry[]
  winners: GiveawayWinner[]
}

export default function GiveawayDetailsPage() {
  const { guildId, giveawayId } = useParams()
  const navigate = useNavigate()

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
                  {giveaway.ended ? (
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
                      {giveaway.cancelled ? 'Cancelado' : 'Finalizado'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
                      Ativo
                    </span>
                  )}
                </div>
              </div>

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

              {giveaway.format === 'list' && giveaway.availableItems && (
                <div className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-4">
                  <div className="text-sm font-semibold">Itens disponíveis ({giveaway.availableItems.length})</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Min: {giveaway.minChoices} • Max: {giveaway.maxChoices}
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
