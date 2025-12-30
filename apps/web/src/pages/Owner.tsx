import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Crown, ExternalLink, Search, Settings, Shield, Users } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, Input, Select, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

type guild = {
  id: string
  name: string
  icon: string | null
  ownerId?: string
  addedAt?: string
}

export default function OwnerPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'name_asc' | 'name_desc' | 'added_desc' | 'added_asc'>('name_asc')

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'guilds'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds`)
      return response.data.guilds as guild[]
    },
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = data ?? []

    const searched = !q
      ? base
      : base.filter((g) => {
          const id_match = g.id.toLowerCase().includes(q)
          const name_match = g.name.toLowerCase().includes(q)
          const owner_match = (g.ownerId ?? '').toLowerCase().includes(q)
          return id_match || name_match || owner_match
        })

    const to_time = (value?: string) => {
      if (!value) return 0
      const parsed = Date.parse(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    return searched.slice().sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      if (sort === 'name_desc') return b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' })

      const a_time = to_time(a.addedAt)
      const b_time = to_time(b.addedAt)
      if (sort === 'added_asc') return a_time - b_time
      return b_time - a_time
    })
  }, [data, query, sort])

  const format_added_at = (value?: string) => {
    if (!value) return null
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return null
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Owner</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Acesso global aos servidores onde o bot está instalado.
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, ID da guild ou ownerId"
            className="pl-10"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
            <option value="name_asc">Nome (A-Z)</option>
            <option value="name_desc">Nome (Z-A)</option>
            <option value="added_desc">Mais recentes</option>
            <option value="added_asc">Mais antigas</option>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          {isLoading ? 'Carregando…' : `${filtered.length} servidor(es)`}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <Card
              key={g.id}
              className="group cursor-pointer transition-colors hover:border-accent/40"
              onClick={() => navigate(`/guild/${g.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {g.icon ? (
                    <img
                      src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`}
                      alt={g.name}
                      className="h-14 w-14 rounded-2xl"
                    />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border/80 bg-surface/70 text-lg font-semibold">
                      <span className="text-accent">{g.name.charAt(0)}</span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold tracking-tight group-hover:text-foreground">
                      {g.name}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{g.id}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {g.ownerId ? <span className="truncate">owner: {g.ownerId}</span> : null}
                      {format_added_at(g.addedAt) ? <span>added: {format_added_at(g.addedAt)}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      navigate(`/guild/${g.id}/overview`)
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      navigate(`/guild/${g.id}/automod`)
                    }}
                  >
                    <Shield className="h-4 w-4" />
                    AutoMod
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      navigate(`/guild/${g.id}/members`)
                    }}
                  >
                    <Users className="h-4 w-4" />
                    Membros
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      navigate(`/guild/${g.id}/settings`)
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      navigator.clipboard.writeText(g.id)
                    }}
                  >
                    <Crown className="h-4 w-4" />
                    Copiar ID
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-base font-semibold">Nenhum servidor encontrado</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Ajuste o filtro de busca ou verifique se o bot já sincronizou os servidores no banco.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
