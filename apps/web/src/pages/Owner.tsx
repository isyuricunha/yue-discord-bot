import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Crown, ExternalLink, RefreshCw, Search, Send, Settings, Shield, Users } from 'lucide-react'

import { getApiUrl } from '../env'
import { Badge, Button, Card, CardContent, Input, Select, Skeleton, Textarea } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

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
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'name_asc' | 'name_desc' | 'added_desc' | 'added_asc'>('name_asc')
  const [added_from, setAddedFrom] = useState('')
  const [added_to, setAddedTo] = useState('')

  const [announcement_content, set_announcement_content] = useState('')
  const [announcement_preview_id, set_announcement_preview_id] = useState<string | null>(null)
  const [announcement_preview, set_announcement_preview] = useState<any>(null)
  const [announcement_confirm, set_announcement_confirm] = useState('')
  const [announcement_result, set_announcement_result] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'guilds'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds`)
      return response.data.guilds as guild[]
    },
  })

  const syncMutation = useMutation({
    mutationFn: async (guild_id: string) => {
      const response = await axios.post(`${API_URL}/api/owner/guilds/${guild_id}/sync`)
      return response.data as { success: boolean; guild: guild }
    },
    onSuccess: (data) => {
      toast_success(`Guild sincronizada: ${data.guild.name}`, 'Sync')
      queryClient.invalidateQueries({ queryKey: ['owner', 'guilds'] })
    },
    onError: (error: any) => {
      const status = error?.response?.status
      const payload = error?.response?.data as { error?: string; removed?: boolean } | undefined

      if (status === 404 && payload?.error === 'Guild not found') {
        if (payload.removed) {
          toast_success('Guild removida do painel (bot não está mais no servidor).', 'Sync')
        } else {
          toast_error('Guild não encontrada (provavelmente já foi removida).', 'Sync falhou')
        }
        queryClient.invalidateQueries({ queryKey: ['owner', 'guilds'] })
        return
      }

      toast_error(payload?.error || error.message || 'Erro ao sincronizar guild', 'Sync falhou')
    },
  })

  const previewAnnouncementMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        content: announcement_content.trim(),
        query: query || undefined,
        addedFrom: added_from || undefined,
        addedTo: added_to || undefined,
      }
      const response = await axios.post(`${API_URL}/api/owner/announcements/preview`, payload)
      return response.data as { success: boolean; previewId: string; preview: any }
    },
    onSuccess: (data) => {
      set_announcement_preview_id(data.previewId)
      set_announcement_preview(data.preview)
      set_announcement_result(null)
      set_announcement_confirm('')
      toast_success('Preview gerado. Revise os alvos antes de enviar.', 'Preview')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao gerar preview', 'Preview falhou')
    },
  })

  const executeAnnouncementMutation = useMutation({
    mutationFn: async () => {
      if (!announcement_preview_id) throw new Error('Preview não encontrado')
      const expected_sendable = typeof announcement_preview?.sendable === 'number' ? announcement_preview.sendable : 0
      const payload = {
        previewId: announcement_preview_id,
        confirm: announcement_confirm,
        expectedSendable: expected_sendable,
      }
      const response = await axios.post(`${API_URL}/api/owner/announcements/execute`, payload)
      return response.data as { success: boolean; result: any }
    },
    onSuccess: (data) => {
      set_announcement_result(data.result)
      toast_success('Anúncio executado. Veja o relatório.', 'Anúncio')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao executar anúncio', 'Anúncio falhou')
    },
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = data ?? []

    const parse_date_input = (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return null
      const match = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      if (!match) return null
      return new Date(`${trimmed}T00:00:00.000Z`)
    }

    const from_date = parse_date_input(added_from)
    const to_date = parse_date_input(added_to)

    const in_range = (added_at?: string) => {
      if (!from_date && !to_date) return true
      if (!added_at) return false
      const parsed = new Date(added_at)
      if (!Number.isFinite(parsed.getTime())) return false

      if (from_date && parsed < from_date) return false
      if (to_date) {
        const end = new Date(to_date)
        end.setUTCDate(end.getUTCDate() + 1)
        if (parsed >= end) return false
      }

      return true
    }

    const searched = !q
      ? base
      : base.filter((g) => {
          const id_match = g.id.toLowerCase().includes(q)
          const name_match = g.name.toLowerCase().includes(q)
          const owner_match = (g.ownerId ?? '').toLowerCase().includes(q)
          return id_match || name_match || owner_match
        })

    const range_filtered = searched.filter((g) => in_range(g.addedAt))

    const to_time = (value?: string) => {
      if (!value) return 0
      const parsed = Date.parse(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    return range_filtered.slice().sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      if (sort === 'name_desc') return b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' })

      const a_time = to_time(a.addedAt)
      const b_time = to_time(b.addedAt)
      if (sort === 'added_asc') return a_time - b_time
      return b_time - a_time
    })
  }, [data, query, sort, added_from, added_to])

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

      <Card className="border-accent/20">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-base font-semibold">Anúncio global</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Envia uma mensagem para as guilds filtradas. Preview é obrigatório.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => previewAnnouncementMutation.mutate()}
                isLoading={previewAnnouncementMutation.isPending}
                disabled={!announcement_content.trim()}
              >
                Preview
              </Button>
              <Button
                type="button"
                onClick={() => executeAnnouncementMutation.mutate()}
                isLoading={executeAnnouncementMutation.isPending}
                disabled={!announcement_preview_id || announcement_confirm !== 'CONFIRMAR'}
              >
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>

          <Textarea
            value={announcement_content}
            onChange={(e) => set_announcement_content(e.target.value)}
            placeholder="Escreva o anúncio (máx 2000 caracteres)."
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <Input
              value={announcement_confirm}
              onChange={(e) => set_announcement_confirm(e.target.value)}
              placeholder="Digite CONFIRMAR para habilitar o envio"
            />
            <div className="text-sm text-muted-foreground">
              Usa os filtros acima (busca e datas) para selecionar os alvos.
            </div>
          </div>

          {announcement_preview && (
            <div className="rounded-2xl border border-border/80 bg-surface/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{announcement_preview.total ?? 0} total</Badge>
                <Badge>{announcement_preview.sendable ?? 0} enviáveis</Badge>
                <Badge>{announcement_preview.skipped ?? 0} puladas</Badge>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Preview ID: <span className="font-mono">{announcement_preview_id}</span>
              </div>
            </div>
          )}

          {announcement_result && (
            <div className="rounded-2xl border border-border/80 bg-surface/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{announcement_result.total ?? 0} processadas</Badge>
                <Badge>{announcement_result.sent ?? 0} enviadas</Badge>
                <Badge>{announcement_result.failed ?? 0} falharam</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
          <Input
            type="date"
            value={added_from}
            onChange={(e) => setAddedFrom(e.target.value)}
            aria-label="Filtrar por data de instalação (início)"
          />
          <Input
            type="date"
            value={added_to}
            onChange={(e) => setAddedTo(e.target.value)}
            aria-label="Filtrar por data de instalação (fim)"
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
                    variant="outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      syncMutation.mutate(g.id)
                    }}
                    isLoading={syncMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Sync
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      navigator.clipboard
                        .writeText(g.id)
                        .then(() => {
                          toast_success(`ID copiado: ${g.id}`, 'Copiado')
                        })
                        .catch(() => {
                          toast_error('Não foi possível copiar o ID. Verifique as permissões do navegador.', 'Falha ao copiar')
                        })
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
