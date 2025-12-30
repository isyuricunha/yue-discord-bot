import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft, Check, Gift, Calendar, Hash, Tag, Plus, Trash2 } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Input, Select, Skeleton, Textarea } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

interface Channel {
  id: string
  name: string
  type: number
}

interface Role {
  id: string
  name: string
  color: number
}

type GiveawayFormat = 'reaction' | 'list'

const list_example_items = ['Nitro (1 mês)', 'Steam R$ 50', 'Cargo VIP (30 dias)', 'Gift Card', 'Prêmio surpresa']

export default function CreateGiveawayPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()
  
  // Multi-step state
  const [step, setStep] = useState(1)
  const totalSteps = 4
  
  // Form data
  const [format, setFormat] = useState<GiveawayFormat>('reaction')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [winners, setWinners] = useState(1)
  const [channelId, setChannelId] = useState('')
  const [requiredRoleId, setRequiredRoleId] = useState('')
  const [endsAt, setEndsAt] = useState('')
  
  // List format specific
  const [items, setItems] = useState<string[]>([])
  const [itemInput, setItemInput] = useState('')
  const [minChoices, setMinChoices] = useState(3)
  const [maxChoices, setMaxChoices] = useState(10)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Fetch channels
  const { data: channelsData, isLoading: is_channels_loading, isError: is_channels_error, refetch: refetch_channels } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return response.data
    },
  })

  // Fetch roles
  const { data: rolesData, isLoading: is_roles_loading, isError: is_roles_error, refetch: refetch_roles } = useQuery({
    queryKey: ['roles', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/roles`)
      return response.data
    },
  })

  const channels = channelsData?.channels || []
  const roles = rolesData?.roles || []

  const addItem = () => {
    if (itemInput.trim() && !items.includes(itemInput.trim())) {
      setItems([...items, itemInput.trim()])
      setItemInput('')
    }
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const add_example_items = () => {
    const existing = new Set(items.map((v) => v.trim()).filter((v) => v.length > 0))
    const next = [...items]

    for (const it of list_example_items) {
      if (!existing.has(it)) next.push(it)
    }

    setItems(next)
    setMinChoices((prev) => Math.min(prev, Math.max(1, next.length)))
    setMaxChoices((prev) => Math.min(Math.max(prev, minChoices), Math.max(1, next.length)))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const payload = {
        title,
        description,
        maxWinners: winners,
        channelId,
        requiredRoleId: requiredRoleId || undefined,
        endsAt: new Date(endsAt).toISOString(),
        format,
        ...(format === 'list' && {
          availableItems: items,
          minChoices,
          maxChoices,
        }),
      }

      await axios.post(`${API_URL}/api/guilds/${guildId}/giveaways`, payload)
      toast_success('Sorteio criado com sucesso!')
      navigate(`/guild/${guildId}/giveaways`)
    } catch (err: any) {
      const message = err.response?.data?.error || 'Erro ao criar sorteio'
      setError(message)
      toast_error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return format !== null
      case 2:
        return title.trim() && description.trim() && winners > 0
      case 3:
        if (format === 'list') {
          return items.length >= minChoices
        }
        return true
      case 4:
        return channelId && endsAt
      default:
        return false
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/guild/${guildId}/giveaways`)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div>
            <div className="text-xl font-semibold tracking-tight">Criar sorteio</div>
            <div className="text-sm text-muted-foreground">Configuração passo a passo</div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Passo {step} de {totalSteps}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Progresso</div>
            <div className="text-sm text-muted-foreground">{Math.round((step / totalSteps) * 100)}%</div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-surface/70">
            <div
              className="h-2 rounded-full bg-accent transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorState title="Não foi possível criar o sorteio" description={error} />}

      {(is_channels_error || is_roles_error) && (
        <ErrorState
          title="Falha ao carregar dados do Discord"
          description="Não foi possível carregar canais e/ou cargos da guild."
          onAction={() => {
            void refetch_channels()
            void refetch_roles()
          }}
        />
      )}

      <Card>
        <CardContent className="p-6">
          {/* Step 1: Choose Format */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Gift className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold tracking-tight">Tipo de sorteio</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Escolha como os participantes vão entrar no sorteio.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setFormat('reaction')}
                  className={
                    format === 'reaction'
                      ? 'rounded-2xl border border-accent/40 bg-accent/10 p-6 text-left transition-colors'
                      : 'rounded-2xl border border-border/80 bg-surface/40 p-6 text-left transition-colors hover:bg-surface/60'
                  }
                >
                  <div className="text-3xl mb-3">🎉</div>
                  <h3 className="text-base font-semibold mb-2">Sorteio por reação</h3>
                  <p className="text-sm text-muted-foreground">
                    Membros reagem com emoji para participar. Simples e rápido.
                  </p>
                </button>

                <button
                  onClick={() => setFormat('list')}
                  className={
                    format === 'list'
                      ? 'rounded-2xl border border-accent/40 bg-accent/10 p-6 text-left transition-colors'
                      : 'rounded-2xl border border-border/80 bg-surface/40 p-6 text-left transition-colors hover:bg-surface/60'
                  }
                >
                  <div className="text-3xl mb-3">📋</div>
                  <h3 className="text-base font-semibold mb-2">Sorteio com lista</h3>
                  <p className="text-sm text-muted-foreground">
                    Membros escolhem itens em ordem de preferência. Ideal para prêmios variados.
                  </p>
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-border/70 bg-surface/40 p-4">
                <div className="text-sm font-semibold">Exemplo</div>
                {format === 'reaction' ? (
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">Reação</span>: o bot posta uma mensagem no canal e o membro participa reagindo.
                    </div>
                    <div className="text-xs">
                      Bom para prêmios únicos (ex: "Nitro 1 mês") e sorteios rápidos.
                    </div>
                    <div className="rounded-xl border border-border/70 bg-surface/60 px-3 py-2 text-xs">
                      <span className="font-mono text-foreground">Título:</span> Sorteio de Nitro
                      <br />
                      <span className="font-mono text-foreground">Vencedores:</span> 1
                      <br />
                      <span className="font-mono text-foreground">Fim:</span> amanhã 20:00
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">Lista</span>: o membro escolhe itens por ordem de preferência.
                    </div>
                    <div className="text-xs">
                      Bom quando há vários prêmios diferentes (ou quando você quer distribuir por preferência).
                    </div>
                    <div className="rounded-xl border border-border/70 bg-surface/60 px-3 py-2 text-xs">
                      Itens (ex): Nitro, Steam R$ 50, Cargo VIP...
                      <br />
                      Min escolhas: 3 • Max escolhas: 5
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Basic Info */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Tag className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold tracking-tight">Informações básicas</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-sm font-medium">Título</div>
                  <div className="mt-2">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Sorteio de Nitro" maxLength={100} />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Descrição</div>
                  <div className="mt-2">
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva o que está sendo sorteado..." maxLength={500} />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Número de vencedores</div>
                  <div className="mt-2">
                    <Input
                      type="number"
                      value={String(winners)}
                      onChange={(e) => setWinners(Number.parseInt(e.target.value, 10) || 1)}
                      min={1}
                      max={50}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Items (if list format) */}
          {step === 3 && format === 'list' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Hash className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold tracking-tight">Lista de itens</h2>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
                  <div className="text-sm font-semibold">Dicas rápidas</div>
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <div>
                      - Adicione todos os prêmios possíveis como itens.
                      <br />
                      - O participante escolhe de <span className="font-semibold text-foreground">min</span> até <span className="font-semibold text-foreground">max</span> itens.
                      <br />
                      - Quanto mais itens, mais sentido faz usar esse formato.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={add_example_items}>
                        Adicionar itens de exemplo
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Adicionar item</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_44px]">
                    <Input
                      value={itemInput}
                      onChange={(e) => setItemInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addItem()}
                      placeholder="Nome do item"
                    />
                    <Button variant="outline" onClick={addItem} className="px-0" aria-label="Adicionar item">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Mínimo de escolhas</div>
                    <div className="mt-2">
                      <Input
                        type="number"
                        value={String(minChoices)}
                        onChange={(e) => setMinChoices(Number.parseInt(e.target.value, 10) || 1)}
                        min={1}
                        max={25}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Máximo de escolhas</div>
                    <div className="mt-2">
                      <Input
                        type="number"
                        value={String(maxChoices)}
                        onChange={(e) => setMaxChoices(Number.parseInt(e.target.value, 10) || 1)}
                        min={minChoices}
                        max={25}
                      />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Recomendação: <span className="font-mono text-foreground">max</span> deve ser menor ou igual ao número de itens.
                </div>

                {items.length > 0 && (
                  <div>
                    <div className="text-sm font-medium">Itens adicionados ({items.length})</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/50 px-4 py-3"
                        >
                          <span className="min-w-0 truncate text-sm text-foreground">{index + 1}. {item}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(index)} aria-label="Remover item">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Skip for reaction format */}
          {step === 3 && format === 'reaction' && (
            <div className="text-center py-8">
              <Gift className="w-16 h-16 text-accent mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Sorteio por reação não requer configuração de itens.</p>
            </div>
          )}

          {/* Step 4: Channel, Role, and Date */}
          {step === 4 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-semibold tracking-tight">Configurações finais</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-sm font-medium">Canal do sorteio</div>
                  <div className="mt-2">
                    {is_channels_loading ? (
                      <Skeleton className="h-11 w-full" />
                    ) : (
                      <Select value={channelId} onValueChange={(value) => setChannelId(value)}>
                        <option value="">Selecione um canal</option>
                        {channels.map((channel: Channel) => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Cargo obrigatório (opcional)</div>
                  <div className="mt-2">
                    {is_roles_loading ? (
                      <Skeleton className="h-11 w-full" />
                    ) : (
                      <Select value={requiredRoleId} onValueChange={(value) => setRequiredRoleId(value)}>
                        <option value="">Nenhum</option>
                        {roles.map((role: Role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Data e hora de término</div>
                  <div className="mt-2">
                    <Input
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border/80">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Voltar
              </Button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                Próximo
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed()} isLoading={isSubmitting}>
                <Check className="h-4 w-4" />
                Criar sorteio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
