import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Coins, Dice5, Swords } from 'lucide-react'

import { verify_coinflip_result } from '@yuebot/shared'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, CardHeader, EmptyState, ErrorState, Input, Select, Skeleton } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'
import { format_luazinhas } from '../lib/luazinhas'

const API_URL = getApiUrl()

type game_user = {
  id: string
  username: string | null
  avatar: string | null
}

type game_row = {
  id: string
  status: 'pending' | 'declined' | 'completed'
  guildId: string | null
  channelId: string | null
  messageId: string | null
  challengerId: string
  opponentId: string
  betAmount: string
  challengerSide: 'heads' | 'tails'
  winnerId: string | null
  resultSide: 'heads' | 'tails' | null
  serverSeedHash?: string | null
  serverSeed?: string | null
  createdAt: string
  resolvedAt: string | null
  challenger?: game_user | null
  opponent?: game_user | null
  winner?: game_user | null
}

export default function CoinflipPage() {
  const [opponent_id, set_opponent_id] = useState('')
  const [bet_amount, set_bet_amount] = useState('')
  const [challenger_side, set_challenger_side] = useState<'heads' | 'tails'>('heads')
  const [is_creating, set_is_creating] = useState(false)

  const [is_resolving, set_is_resolving] = useState<string | null>(null)
  const [is_verifying, set_is_verifying] = useState<string | null>(null)

  const {
    data: stats,
    isLoading: is_stats_loading,
    isError: is_stats_error,
    refetch: refetch_stats,
  } = useQuery({
    queryKey: ['coinflip', 'stats', 'me'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/coinflip/stats/me`)
      return res.data as {
        success: boolean
        played: number
        wins: number
        losses: number
        won: string
        lost: string
        net: string
      }
    },
  })

  const {
    data: games_data,
    isLoading: is_games_loading,
    isError: is_games_error,
    refetch: refetch_games,
  } = useQuery({
    queryKey: ['coinflip', 'games'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/coinflip/games`, { params: { limit: 50, offset: 0 } })
      return res.data as { success: boolean; games: game_row[]; total: number }
    },
  })

  const net_label = useMemo(() => {
    return format_luazinhas(stats?.net ?? '0')
  }, [stats?.net])

  const create_bet = async () => {
    set_is_creating(true)
    try {
      const payload = {
        opponentId: opponent_id.trim(),
        betAmount: bet_amount.trim(),
        challengerSide: challenger_side,
      }

      await axios.post(`${API_URL}/api/coinflip/bet`, payload)
      toast_success('Aposta criada!')
      set_bet_amount('')
      await Promise.all([refetch_games(), refetch_stats()])
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao criar aposta'
      toast_error(msg)
    } finally {
      set_is_creating(false)
    }
  }

  const action = async (mode: 'accept' | 'decline', gameId: string) => {
    set_is_resolving(gameId)
    try {
      await axios.post(`${API_URL}/api/coinflip/${mode}`, { gameId })
      toast_success(mode === 'accept' ? 'Aposta aceita e resolvida!' : 'Aposta recusada!')
      await Promise.all([refetch_games(), refetch_stats()])
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao processar ação'
      toast_error(msg)
    } finally {
      set_is_resolving(null)
    }
  }

  const verify_fairness = async (game: game_row) => {
    if (game.status !== 'completed') return
    if (!game.serverSeed || !game.serverSeedHash || !game.resultSide) {
      toast_error('Dados insuficientes para verificar')
      return
    }

    set_is_verifying(game.id)
    try {
      const res = await verify_coinflip_result({
        serverSeed: game.serverSeed,
        serverSeedHash: game.serverSeedHash,
        gameId: game.id,
        resultSide: game.resultSide,
      })

      if (res.ok) {
        toast_success('Verificação OK (provably fair)')
      } else {
        toast_error(`Verificação falhou: ${res.reason}`)
      }
    } catch {
      toast_error('Erro ao verificar')
    } finally {
      set_is_verifying(null)
    }
  }

  if (is_stats_error || is_games_error) {
    return (
      <ErrorState
        title="Não foi possível carregar coinflip"
        description="Falha ao buscar estatísticas e/ou histórico."
        onAction={() => {
          void refetch_stats()
          void refetch_games()
        }}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Cara ou Coroa</div>
          <div className="mt-1 text-sm text-muted-foreground">Crie apostas e aceite/recuse pelo painel</div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={() => {
            void refetch_stats()
            void refetch_games()
          }}
        >
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-accent" />
              <div className="text-sm font-semibold">Criar aposta</div>
            </div>
            <div className="text-xs text-muted-foreground">Aposta pendente até o oponente aceitar</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="ID do usuário no Discord" value={opponent_id} onChange={(e) => set_opponent_id(e.target.value)} />
            <Input placeholder="Quantia (cada jogador)" value={bet_amount} onChange={(e) => set_bet_amount(e.target.value)} />

            <Select
              value={challenger_side}
              onValueChange={(v) => set_challenger_side(v as 'heads' | 'tails')}
            >
              <option value="heads">Cara</option>
              <option value="tails">Coroa</option>
            </Select>

            <Button
              className="w-full"
              isLoading={is_creating}
              disabled={!opponent_id.trim() || !bet_amount.trim()}
              onClick={() => void create_bet()}
            >
              Criar aposta
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Dice5 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-muted-foreground">Seu saldo líquido</div>
                <div className="text-lg font-semibold">
                  {is_stats_loading ? <Skeleton className="h-5 w-24" /> : `${net_label} luazinhas`}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border/70 bg-surface/40 p-3">
                <div className="text-xs text-muted-foreground">Partidas</div>
                <div className="text-sm font-semibold">{is_stats_loading ? '-' : stats?.played ?? 0}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/40 p-3">
                <div className="text-xs text-muted-foreground">Vitórias</div>
                <div className="text-sm font-semibold">{is_stats_loading ? '-' : stats?.wins ?? 0}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/40 p-3">
                <div className="text-xs text-muted-foreground">Derrotas</div>
                <div className="text-sm font-semibold">{is_stats_loading ? '-' : stats?.losses ?? 0}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Coins className="h-3.5 w-3.5" />
              <span>
                Ganhas: {is_stats_loading ? '-' : format_luazinhas(stats?.won ?? '0')} • Perdidas:{' '}
                {is_stats_loading ? '-' : format_luazinhas(stats?.lost ?? '0')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <div className="text-sm font-semibold">Apostas</div>
          <div className="text-xs text-muted-foreground">Últimas 50 (pendentes/recusadas/fechadas)</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {is_games_loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : games_data?.games?.length ? (
            <div className="space-y-2">
              {games_data.games.map((g) => {
                const is_pending = g.status === 'pending'
                const can_verify = g.status === 'completed' && !!g.serverSeed && !!g.serverSeedHash && !!g.resultSide
                return (
                  <div key={g.id} className="rounded-xl border border-border/70 bg-surface/40 px-3 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {g.status.toUpperCase()} • {format_luazinhas(g.betAmount)} luazinhas
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          challenger {g.challengerId} vs opponent {g.opponentId} • lado {g.challengerSide}
                        </div>
                        {g.winnerId && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            winner {g.winnerId} • result {g.resultSide}
                          </div>
                        )}
                        {!!g.serverSeedHash && (
                          <div className="mt-1 text-xs text-muted-foreground break-all">
                            commit (server seed hash) {g.serverSeedHash}
                          </div>
                        )}
                        {g.status === 'completed' && !!g.serverSeed && (
                          <div className="mt-1 text-xs text-muted-foreground break-all">
                            reveal (server seed) {g.serverSeed}
                          </div>
                        )}
                      </div>

                      {is_pending && (
                        <div className="shrink-0">
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={is_resolving === g.id}
                              onClick={() => void action('accept', g.id)}
                            >
                              Aceitar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={is_resolving === g.id}
                              onClick={() => void action('decline', g.id)}
                            >
                              Recusar
                            </Button>
                          </div>
                        </div>
                      )}

                      {!is_pending && (
                        <div className="shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!can_verify}
                            isLoading={is_verifying === g.id}
                            onClick={() => void verify_fairness(g)}
                          >
                            Verificar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState title="Nenhuma aposta" description="Ainda não há apostas para exibir." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
