import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useDeferredValue, useState } from 'react'
import { Search, Shield, AlertTriangle, User } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Input, Select, Skeleton, PageHeader, ModuleLayout } from '../components/ui'

const API_URL = getApiUrl()
const ITEMS_PER_PAGE = 12

interface Member {
  id: string
  userId: string
  username: string
  avatar: string | null
  joinedAt: string
  warnings: number
  notes: string | null
}

interface MemberPage {
  success: boolean
  members: Member[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function MembersPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm.trim())
  const [warningFilter, setWarningFilter] = useState('all')
  const [page, setPage] = useState(1)

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['members', guildId, page, deferredSearch, warningFilter],
    queryFn: async () => {
      const response = await axios.get<MemberPage>(`${API_URL}/api/guilds/${guildId}/members`, {
        params: {
          page,
          limit: ITEMS_PER_PAGE,
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(warningFilter !== 'all' ? { warnings: warningFilter } : {}),
        },
      })
      return response.data
    },
  })

  const members = data?.members ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const has_filters = searchTerm.trim().length > 0 || warningFilter !== 'all'

  return (
    <ModuleLayout>
      <PageHeader
        icon={User}
        title="Membros"
        description="Gerencie membros e histórico de avisos"
      />

      {isError && (
        <ErrorState
          title="Falha ao carregar membros"
          description="Não foi possível buscar os membros desta guild."
          onAction={() => refetch()}
        />
      )}

      <Card className="border-accent/20">
        <CardContent className="space-y-4 p-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setPage(1)
              }}
              className="pl-11"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <Select
              value={warningFilter}
              onValueChange={(value) => {
                setWarningFilter(value)
                setPage(1)
              }}
            >
              <option value="all">Todos os membros</option>
              <option value="clean">Sem warns</option>
              <option value="low">1-3 warns</option>
              <option value="high">4+ warns</option>
            </Select>

            {has_filters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setWarningFilter('all')
                  setPage(1)
                }}
                className="h-10"
              >
                Limpar
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {total} membro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          title={has_filters ? 'Nenhum membro encontrado' : 'Nenhum membro registrado'}
          description={has_filters ? 'Tente ajustar os filtros ou o termo de busca.' : 'Este servidor não possui membros registrados.'}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <Card key={member.id} className="group transition-colors hover:border-accent/50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {member.avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${member.userId}/${member.avatar}.png`}
                        alt={member.username}
                        className="h-12 w-12 rounded-2xl"
                      />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border/80 bg-surface/70">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold tracking-tight">{member.username}</div>
                      <div className="mt-1 text-xs text-muted-foreground">ID: {member.userId}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Entrou em {new Date(member.joinedAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/50 px-3 py-1 text-xs">
                      <AlertTriangle className="h-4 w-4 text-accent" />
                      <span className="font-semibold">{member.warnings}</span>
                      <span className="text-muted-foreground">warns</span>
                    </div>

                    <Button size="sm" onClick={() => navigate(`/guild/${guildId}/members/${member.userId}`)} className="shrink-0">
                      <Shield className="h-4 w-4" />
                      Detalhes
                    </Button>
                  </div>

                  {member.notes && (
                    <div className="mt-4 rounded-xl border border-border/70 bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Notas:</span> {member.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} • {total} membros
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </ModuleLayout>
  )
}
