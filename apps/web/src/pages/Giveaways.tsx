import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Trophy, Calendar, Users, CheckCircle, Clock, Plus } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

interface Giveaway {
  id: string
  title: string
  description: string
  channelId: string
  messageId: string | null
  maxWinners: number
  endsAt: string
  ended: boolean
  cancelled: boolean
  createdAt: string
  _count: {
    entries: number
    winners: number
  }
}

export default function GiveawaysPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['giveaways', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/giveaways`)
      return response.data
    },
  })

  const giveaways = data?.giveaways || []
  const activeGiveaways = giveaways.filter((g: Giveaway) => !g.ended && !g.cancelled)
  const endedGiveaways = giveaways.filter((g: Giveaway) => g.ended || g.cancelled)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-semibold tracking-tight">Sorteios</div>
          <div className="mt-1 text-sm text-muted-foreground">Gerencie sorteios do servidor</div>
        </div>

        <Button onClick={() => navigate(`/guild/${guildId}/giveaways/create`)}>
          <Plus className="h-4 w-4" />
          <span>Criar sorteio</span>
        </Button>
      </div>

      <Card className="border-accent/20">
        <CardContent className="p-6 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Dica:</span> você pode criar sorteios via Web ou usar <span className="font-mono text-foreground">/sorteio-wizard</span> no Discord.
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="mt-3 h-4 w-2/3" />
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : giveaways.length === 0 ? (
        <EmptyState title="Nenhum sorteio criado" description="Crie um sorteio para começar." />
      ) : (
        <>
          {activeGiveaways.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-accent" />
                <span>Sorteios ativos ({activeGiveaways.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeGiveaways.map((giveaway: Giveaway) => (
                  <GiveawayCard key={giveaway.id} giveaway={giveaway} guildId={guildId!} />
                ))}
              </div>
            </div>
          )}

          {endedGiveaways.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <span>Sorteios finalizados ({endedGiveaways.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {endedGiveaways.map((giveaway: Giveaway) => (
                  <GiveawayCard key={giveaway.id} giveaway={giveaway} guildId={guildId!} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function GiveawayCard({ giveaway, guildId }: { giveaway: Giveaway; guildId: string }) {
  const navigate = useNavigate()
  const endsAt = new Date(giveaway.endsAt)
  const isActive = !giveaway.ended && !giveaway.cancelled

  return (
    <Card
      className={
        isActive
          ? 'cursor-pointer transition-colors hover:border-accent/40'
          : giveaway.cancelled
            ? 'cursor-pointer opacity-70'
            : 'cursor-pointer transition-colors hover:border-border/60'
      }
      onClick={() => navigate(`/guild/${guildId}/giveaways/${giveaway.id}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60">
            <Trophy className={isActive ? 'h-5 w-5 text-accent' : 'h-5 w-5 text-muted-foreground'} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold tracking-tight">{giveaway.title}</div>
            <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{giveaway.description}</div>
            {giveaway.cancelled && <div className="mt-2 text-xs font-semibold text-muted-foreground">Cancelado</div>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface/50 px-3 py-2">
            <Users className="h-4 w-4" />
            <span>{giveaway._count.entries}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface/50 px-3 py-2">
            <Trophy className="h-4 w-4" />
            <span>
              {giveaway._count.winners}/{giveaway.maxWinners}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface/50 px-3 py-2">
            <Calendar className="h-4 w-4" />
            <span>{endsAt.toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
