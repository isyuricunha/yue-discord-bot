import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft, Search, TerminalSquare } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Input, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

type api_command = {
  name: string
  json: any
}

type api_response = {
  success: boolean
  slashCommands: api_command[]
  contextMenuCommands: api_command[]
}

function command_description(cmd: api_command): string {
  const json = cmd.json
  const desc = typeof json?.description === 'string' ? json.description : ''
  return desc
}

export default function CommandsPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['commands', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/commands`)
      return res.data as api_response
    },
  })

  const q = query.trim().toLowerCase()

  const filtered_slash = useMemo(() => {
    const list = data?.slashCommands ?? []
    if (!q) return list
    return list.filter((c) => {
      const hay = `${c.name} ${command_description(c)}`.toLowerCase()
      return hay.includes(q)
    })
  }, [data?.slashCommands, q])

  const filtered_context = useMemo(() => {
    const list = data?.contextMenuCommands ?? []
    if (!q) return list
    return list.filter((c) => {
      const hay = `${c.name}`.toLowerCase()
      return hay.includes(q)
    })
  }, [data?.contextMenuCommands, q])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/guild/${guildId}/overview`)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div>
            <div className="text-xl font-semibold tracking-tight">Comandos</div>
            <div className="mt-1 text-sm text-muted-foreground">Lista de comandos carregados no bot</div>
          </div>
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Erro ao carregar comandos"
          description="Não foi possível carregar a lista de comandos."
          onAction={() => void refetch()}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome/descrição" className="pl-9" />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="mb-3 text-sm font-semibold">Slash commands</div>
                {filtered_slash.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum comando encontrado.</div>
                ) : (
                  <div className="space-y-2">
                    {filtered_slash.map((cmd) => (
                      <div key={cmd.name} className="rounded-2xl border border-border/70 bg-surface/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <TerminalSquare className="h-4 w-4 text-accent" />
                              <div className="truncate text-sm font-semibold">/{cmd.name}</div>
                            </div>
                            {command_description(cmd) ? (
                              <div className="mt-1 text-xs text-muted-foreground">{command_description(cmd)}</div>
                            ) : null}
                          </div>
                        </div>

                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-surface/60 p-3 text-xs text-foreground">
                          {JSON.stringify(cmd.json, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold">Context menu</div>
                {filtered_context.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum comando encontrado.</div>
                ) : (
                  <div className="space-y-2">
                    {filtered_context.map((cmd) => (
                      <div key={cmd.name} className="rounded-2xl border border-border/70 bg-surface/40 p-4">
                        <div className="text-sm font-semibold">{cmd.name}</div>
                        <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-surface/60 p-3 text-xs text-foreground">
                          {JSON.stringify(cmd.json, null, 2)}
                        </pre>
                      </div>
                    ))}
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
