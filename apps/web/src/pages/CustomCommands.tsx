import { useState } from 'react'
import { Command, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, Input, Skeleton, Textarea } from '../components/ui'
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
  const { data: commands, isLoading } = useQuery<CustomCommand[]>({
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
    }
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
      toast_error('Erro ao deletar o comando.')
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !response.trim()) {
       toast_error('Nome e Resposta são campos obrigatórios.')
       return
    }
    createMutation.mutate({ name, description, response })
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <Command className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Comandos Customizados</div>
            <div className="text-sm text-muted-foreground">Crie atalhos e respostas automáticas interagindo com a Yue</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-accent/20 lg:col-span-2 h-fit">
          <CardContent className="space-y-4 p-6">
            <div>
              <div className="text-sm font-semibold">Novo Comando</div>
              <div className="mt-1 text-xs text-muted-foreground">O bot responderá exatamente com esse texto.</div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Comando (Gatilho)</label>
                <Input 
                   placeholder="Ex: !regras" 
                   value={name} 
                   onChange={(e) => setName(e.target.value)} 
                   disabled={createMutation.isPending}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição (Opcional)</label>
                <Input 
                   placeholder="Ex: Mostra as regras do servidor" 
                   value={description} 
                   onChange={(e) => setDescription(e.target.value)} 
                   disabled={createMutation.isPending}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Resposta da Yue</label>
                <Textarea 
                   placeholder="Mensagem a ser enviada..." 
                   className="h-32 resize-none" 
                   value={response} 
                   onChange={(e) => setResponse(e.target.value)}
                   disabled={createMutation.isPending}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 shrink-0" />
                <span>Adicionar Comando</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-accent/20 lg:col-span-3">
          <CardContent className="space-y-4 p-6">
            <div>
              <div className="text-sm font-semibold">Comandos Ativos</div>
              <div className="mt-1 text-xs text-muted-foreground">Lista de respostas automáticas configuradas neste servidor.</div>
            </div>

            {isLoading ? (
               <div className="space-y-3">
                 {Array.from({ length: 4 }).map((_, i) => (
                   <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                 ))}
               </div>
            ) : !commands?.length ? (
               <EmptyState title="Nenhum comando criado" description="Adicione seu primeiro comando ao lado." />
            ) : (
              <div className="space-y-3">
                {commands.map((cmd) => (
                  <div key={cmd.id} className="rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                           <MessageSquare className="h-4 w-4 text-accent" />
                           <span className="font-semibold text-sm">{cmd.name}</span>
                        </div>
                        {cmd.description && <div className="mt-1 text-xs font-medium text-muted-foreground">{cmd.description}</div>}
                        <div className="mt-2 text-xs text-foreground/80 bg-background/50 p-2 rounded-lg border border-border/50">
                          {cmd.response}
                        </div>
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteMutation.mutate(cmd.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                        aria-label="Deletar comando"
                      >
                         <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
