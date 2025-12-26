import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, User, FileText, Save } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Skeleton, Textarea } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

interface MemberDetails {
  id: string
  userId: string
  guildId: string
  username: string
  avatar: string | null
  joinedAt: string
  warnings: number
  notes: string | null
  modLogs: {
    id: string
    action: string
    moderatorId: string
    reason: string | null
    createdAt: string
    duration: string | null
  }[]
}

export default function MemberDetailsPage() {
  const { guildId, userId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const has_initialized = useRef(false)

  const {
    data: member,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['member', guildId, userId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/members/${userId}`)
      return response.data as MemberDetails
    },
  })

  useEffect(() => {
    if (!member) return
    if (has_initialized.current) return
    has_initialized.current = true
    setNotes(member.notes || '')
  }, [member])

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      await axios.patch(`${API_URL}/api/guilds/${guildId}/members/${userId}`,
        {
          notes: newNotes,
        }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', guildId, userId] })
      setIsEditingNotes(false)
      toast_success('Notas salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar notas')
    },
  })

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes)
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/guild/${guildId}/members`)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>

          <div className="min-w-0">
            <div className="text-xl font-semibold tracking-tight">Membro</div>
            <div className="text-sm text-muted-foreground">Detalhes e histórico</div>
          </div>
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Falha ao carregar membro"
          description="Não foi possível buscar os detalhes do membro."
          onAction={() => refetch()}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-5 w-44" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : !member ? (
        <EmptyState title="Membro não encontrado" description="Verifique se o usuário existe e se você tem acesso." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  {member.avatar ? (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${member.userId}/${member.avatar}.png`}
                      alt={member.username}
                      className="h-14 w-14 rounded-2xl"
                    />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border/80 bg-surface/70">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">{member.username}</div>
                    <div className="mt-1 text-xs text-muted-foreground">ID: {member.userId}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border/70 bg-surface/50 p-3 text-center">
                    <div className="text-xs text-muted-foreground">Warns</div>
                    <div className="mt-1 text-lg font-semibold text-accent">{member.warnings}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface/50 p-3 text-center">
                    <div className="text-xs text-muted-foreground">Ações</div>
                    <div className="mt-1 text-lg font-semibold">{member.modLogs.length}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface/50 p-3 text-center">
                    <div className="text-xs text-muted-foreground">Desde</div>
                    <div className="mt-1 text-xs font-medium">
                      {new Date(member.joinedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Notas do moderador</div>
                    <div className="text-xs text-muted-foreground">Privado (painel)</div>
                  </div>

                  {!isEditingNotes && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(true)}>
                      Editar
                    </Button>
                  )}
                </div>

                <div className="mt-4">
                  {isEditingNotes ? (
                    <div className="space-y-3">
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Adicione notas sobre este membro..." />
                      <div className="flex gap-2">
                        <Button onClick={handleSaveNotes} isLoading={updateNotesMutation.isPending} className="flex-1">
                          <Save className="h-4 w-4" />
                          <span>Salvar</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setNotes(member.notes || '')
                            setIsEditingNotes(false)
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {member.notes || 'Nenhuma nota adicionada'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                <div className="text-sm font-semibold">Histórico de moderação</div>
              </div>

              {member.modLogs.length === 0 ? (
                <EmptyState title="Nenhuma ação registrada" description="Ainda não há ações de moderação para este membro." />
              ) : (
                <div className="space-y-3">
                  {member.modLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-border/70 bg-surface/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-accent">
                          {log.action}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-sm">
                        <div className="text-muted-foreground">
                          Moderador: <span className="text-foreground">{log.moderatorId}</span>
                        </div>
                        {log.reason && <div className="text-muted-foreground">Razão: <span className="text-foreground">{log.reason}</span></div>}
                        {log.duration && <div className="text-muted-foreground">Duração: <span className="text-foreground">{log.duration}</span></div>}
                      </div>
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
