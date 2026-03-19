import { useState, type FormEvent } from 'react'
import { Plus, Trash, Command } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { PageLayout, PageSection } from '../components/design'
import { Button, Card, CardContent, CardHeader, EmptyState, ErrorState, Input, Skeleton, Textarea } from '../components/ui'
import { getApiUrl } from '../env'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

interface CustomCommand {
  id: string
  name: string
  description: string | null
  response: string
}

export default function CustomCommandsPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [response, setResponse] = useState('')

  // Buscando os comandos de acordo com a API
  const {
    data: commands,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CustomCommand[]>({
    queryKey: ['custom-commands', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/custom-commands`)
      return res.data
    },
    enabled: !!guildId,
  })

  // Hook Mutável para a criação
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; response: string }) => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/custom-commands`, data)
    },
    onSuccess: () => {
      toast_success('Comando criado com sucesso.')
      setName('')
      setDescription('')
      setResponse('')
      queryClient.invalidateQueries({ queryKey: ['custom-commands', guildId] })
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || 'Erro ao criar o comando.')
    },
  })

  // Hook Mutável para a exclusão
  const deleteMutation = useMutation({
    mutationFn: async (commandId: string) => {
      await axios.delete(`${API_URL}/api/guilds/${guildId}/custom-commands/${commandId}`)
    },
    onSuccess: () => {
      toast_success('Comando removido.')
      queryClient.invalidateQueries({ queryKey: ['custom-commands', guildId] })
    },
    onError: () => {
      toast_error('Erro ao remover o comando.')
    },
  })

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !response.trim()) {
      toast_error('Nome e resposta são campos obrigatórios.')
      return
    }
    createMutation.mutate({ name, description, response })
  }

  const handleDelete = (command: CustomCommand) => {
    if (!window.confirm(`Remover o comando "${command.name}"?`)) return
    deleteMutation.mutate(command.id)
  }

  return (
    <PageLayout
      title="Comandos personalizados"
      description="Crie atalhos e respostas automáticas para quando usuários usarem um gatilho no chat."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <PageSection>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Command className="h-5 w-5" />
                <h2 className="text-lg font-semibold leading-none tracking-tight">Criar comando</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                A resposta será enviada sempre que alguém digitar o gatilho exatamente como definido.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome / gatilho</label>
                  <Input
                    placeholder="Ex: !regras"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={createMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição (opcional)</label>
                  <Input
                    placeholder="Ex: Mostra as regras gerais do servidor."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={createMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Resposta</label>
                  <Textarea
                    placeholder="Mensagem a ser enviada..."
                    className="h-32"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    disabled={createMutation.isPending}
                  />
                </div>

                <Button type="submit" className="w-full" isLoading={createMutation.isPending} disabled={createMutation.isPending}>
                  <Plus className="h-4 w-4" />
                  <span>Adicionar</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </PageSection>

        <PageSection>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold leading-none tracking-tight">Comandos ativos</h2>
            </CardHeader>
            <CardContent>
              {isError && (
                <ErrorState
                  title="Erro ao carregar comandos"
                  description={(error as any)?.message || 'Não foi possível carregar os comandos personalizados.'}
                  onAction={() => void refetch()}
                />
              )}

              {isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              )}

              {!isLoading && !isError && (!commands || commands.length === 0) && (
                <EmptyState title="Nenhum comando criado" description="Crie um comando à esquerda para começar." />
              )}

              {!isLoading && !isError && commands && commands.length > 0 && (
                <div className="space-y-3">
                  {commands.map((cmd) => (
                    <div
                      key={cmd.id}
                      className="rounded-xl border border-border/80 bg-surface/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{cmd.name}</div>
                          {cmd.description && <div className="mt-1 text-sm text-muted-foreground">{cmd.description}</div>}
                        </div>

                        <Button
                          variant="ghost"
                          onClick={() => handleDelete(cmd)}
                          disabled={deleteMutation.isPending}
                          aria-label={`Remover ${cmd.name}`}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="mt-3 rounded-lg bg-background/60 p-3 text-sm text-muted-foreground">
                        <div className="line-clamp-3 whitespace-pre-wrap">{cmd.response}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </PageSection>
      </div>
    </PageLayout>
  )
}
