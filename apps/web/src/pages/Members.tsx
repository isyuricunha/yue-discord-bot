import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useState } from 'react'
import { Search, Shield, AlertTriangle, User } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Input, Select, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

interface Member {
  id: string
  userId: string
  username: string
  avatar: string | null
  joinedAt: string
  warnings: number
  notes: string | null
}

export default function MembersPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [warningFilter, setWarningFilter] = useState('all')
  const [page, setPage] = useState(1)
  const itemsPerPage = 12

  const {
    data: members,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['members', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/members`)
      return (response.data as { success: boolean; members: Member[] }).members
    },
  })

  // Filtrar membros
  const filteredMembers = members?.filter(member => {
    // Filtro por busca
    const matchesSearch = member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.userId.includes(searchTerm)
    
    if (!matchesSearch) return false

    // Filtro por warnings
    if (warningFilter === 'clean') return member.warnings === 0
    if (warningFilter === 'low') return member.warnings >= 1 && member.warnings <= 3
    if (warningFilter === 'high') return member.warnings >= 4
    
    return true
  })

  // Paginação
  const totalPages = Math.ceil((filteredMembers?.length || 0) / itemsPerPage)
  const startIndex = (page - 1) * itemsPerPage
  const paginatedMembers = filteredMembers?.slice(startIndex, startIndex + itemsPerPage)

  const has_filters = searchTerm.trim().length > 0 || warningFilter !== 'all'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold tracking-tight">Membros</div>
          <div className="mt-1 text-sm text-muted-foreground">Gerencie membros e histórico de avisos</div>
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Falha ao carregar membros"
          description="Não foi possível buscar os membros desta guild."
          onAction={() => refetch()}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
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

          {has_filters && (
            <div className="text-sm text-muted-foreground">
              {(filteredMembers?.length || 0)} membro{(filteredMembers?.length || 0) !== 1 ? 's' : ''} encontrado
              {(filteredMembers?.length || 0) !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !paginatedMembers || paginatedMembers.length === 0 ? (
        <EmptyState
          title={searchTerm ? 'Nenhum membro encontrado' : 'Nenhum membro registrado'}
          description={searchTerm ? 'Tente ajustar os filtros ou o termo de busca.' : 'Este servidor não retornou membros.'}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedMembers.map((member) => (
              <Card key={member.id} className="group transition-colors hover:border-accent/40">
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

                    <Button
                      size="sm"
                      onClick={() => navigate(`/guild/${guildId}/members/${member.userId}`)}
                      className="shrink-0"
                    >
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

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} • {filteredMembers?.length || 0} membros
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
