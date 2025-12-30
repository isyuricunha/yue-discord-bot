import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Search } from 'lucide-react'

import { getApiUrl } from '../env'
import { Card, CardContent, Input, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

type guild = {
  id: string
  name: string
  icon: string | null
}

export default function OwnerPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'guilds'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds`)
      return response.data.guilds as guild[]
    },
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data ?? []

    return (data ?? []).filter((g) => {
      const id_match = g.id.toLowerCase().includes(q)
      const name_match = g.name.toLowerCase().includes(q)
      return id_match || name_match
    })
  }, [data, query])

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
            placeholder="Buscar por nome ou ID da guild"
            className="pl-10"
          />
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
                  </div>
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
