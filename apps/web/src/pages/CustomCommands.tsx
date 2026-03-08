import { useState } from 'react'
import { Plus, Trash, Command } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { getApiUrl } from '../env'

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
      toast.success('Comando criado com sucesso.')
      setName('')
      setDescription('')
      setResponse('')
      queryClient.invalidateQueries({ queryKey: ['custom-commands', guildId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao criar o comando.')
    }
  })

  // Hook Mutável para a exclusão
  const deleteMutation = useMutation({
    mutationFn: async (commandId: string) => {
      await axios.delete(`${API_URL}/api/guilds/${guildId}/custom-commands/${commandId}`)
    },
    onSuccess: () => {
      toast.success('Comando removido.')
      queryClient.invalidateQueries({ queryKey: ['custom-commands', guildId] })
    },
    onError: () => {
      toast.error('Erro ao deletar o comando.')
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !response.trim()) {
       toast.error('Nome e Resposta são campos obrigatórios.')
       return
    }
    createMutation.mutate({ name, description, response })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 dark:text-gray-100 flex items-center gap-2">
          <Command className="h-5 w-5" />
          Comandos Personalizados
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Crie atalhos e respostas automáticas inteligentes quando usuários invocarem a Yue.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h4 className="font-semibold text-lg leading-none tracking-tight">Criar Novo Comando</h4>
            <p className="text-sm text-muted-foreground">
              A resposta será enviada todas as vezes que alguém utilizar a palavra exata em um canal.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome / Gatilho</label>
                <Input 
                   placeholder="Ex: !regras" 
                   value={name} 
                   onChange={(e) => setName(e.target.value)} 
                   disabled={createMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição (Opcional)</label>
                <Input 
                   placeholder="Ex: Mostra as regras gerais do servidor." 
                   value={description} 
                   onChange={(e) => setDescription(e.target.value)} 
                   disabled={createMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resposta da Yue</label>
                <Textarea 
                   placeholder="Mensagem a ser enviada..." 
                   className="h-32" 
                   value={response} 
                   onChange={(e) => setResponse(e.target.value)}
                   disabled={createMutation.isPending}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Comando
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
             <h4 className="font-semibold text-lg leading-none tracking-tight">Comandos Ativos</h4>
          </CardHeader>
          <CardContent>
            {isLoading ? (
               <div className="text-center text-sm text-zinc-500 my-8">Carregando comandos...</div>
            ) : !commands?.length ? (
               <div className="text-center text-zinc-500 my-8">Nenhum comando criado.</div>
            ) : (
              <div className="space-y-3">
                {commands.map((cmd) => (
                  <div key={cmd.id} className="flex flex-col space-y-2 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg relative">
                     <div className="flex justify-between items-start">
                        <div className="font-semibold">{cmd.name}</div>
                        <Button 
                           variant="ghost" 
                           onClick={() => deleteMutation.mutate(cmd.id)}
                           disabled={deleteMutation.isPending}
                        >
                           <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                     </div>
                     {cmd.description && <div className="text-sm text-zinc-500">{cmd.description}</div>}
                     <div className="text-sm bg-zinc-50 dark:bg-zinc-900 p-2 rounded truncate">
                       {cmd.response}
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
