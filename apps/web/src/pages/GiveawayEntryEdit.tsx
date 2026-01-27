import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUp, ArrowDown, Save, Trash2, Plus, Clock } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Select, Skeleton } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type api_response = {
  success: boolean
  tokenExpiresAt: string
  giveaway: {
    id: string
    title: string
    description: string
    endsAt: string
    format: string
    minChoices: number | null
    maxChoices: number | null
  }
  entry: {
    userId: string
    username: string
    choices: string[] | null
  }
  availableItems: string[]
}

export default function GiveawayEntryEditPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isError,
    refetch,
    error,
  } = useQuery({
    queryKey: ['giveaway_entry_edit', token],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/giveaway-entry-edit/${token}`)
      return res.data as api_response
    },
    enabled: Boolean(token),
    retry: 1,
  })

  const giveaway = data?.giveaway
  const available_items = data?.availableItems ?? []

  const [choices, setChoices] = useState<string[]>([])
  const [add_value, setAddValue] = useState('')

  useEffect(() => {
    const initial = data?.entry?.choices
    if (Array.isArray(initial)) {
      setChoices(initial)
    } else {
      setChoices([])
    }
  }, [data?.entry?.choices])

  const min_choices = giveaway?.minChoices ?? null
  const max_choices = giveaway?.maxChoices ?? null

  const is_count_valid = useMemo(() => {
    if (!giveaway) return false

    if (min_choices !== null && choices.length < min_choices) return false
    if (max_choices !== null && choices.length > max_choices) return false
    return true
  }, [choices.length, giveaway, max_choices, min_choices])

  const remaining_options = useMemo(() => {
    const selected = new Set(choices.map((c) => c.toLowerCase()))
    return available_items.filter((i) => !selected.has(i.toLowerCase()))
  }, [available_items, choices])

  const move_choice = (index: number, dir: -1 | 1) => {
    setChoices((prev) => {
      const next = prev.slice()
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  const remove_choice = (index: number) => {
    setChoices((prev) => prev.filter((_, i) => i !== index))
  }

  const add_choice = () => {
    if (!add_value) return
    setChoices((prev) => prev.concat(add_value))
    setAddValue('')
  }

  const save_mutation = useMutation({
    mutationFn: async () => {
      await axios.patch(`${API_URL}/api/giveaway-entry-edit/${token}`, { choices })
    },
    onSuccess: async () => {
      toast_success('Escolhas atualizadas!')
      await queryClient.invalidateQueries({ queryKey: ['giveaway_entry_edit', token] })
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || 'Erro ao salvar escolhas'
      toast_error(message)
    },
  })

  const expires_label = useMemo(() => {
    const value = data?.tokenExpiresAt
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `<t:${Math.floor(date.getTime() / 1000)}:R>`
  }, [data?.tokenExpiresAt])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-10">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>

          <div>
            <div className="text-xl font-semibold tracking-tight">Editar escolhas do sorteio</div>
            <div className="text-sm text-muted-foreground">Link temporário</div>
          </div>
        </div>
      </div>

      {isError ? (
        <ErrorState
          title="Erro ao carregar"
          description={(error as any)?.response?.data?.error || 'Não foi possível abrir o link.'}
          onAction={() => void refetch()}
        />
      ) : isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : !giveaway ? (
        <EmptyState title="Link inválido" description="Verifique se o token está correto." />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="text-lg font-semibold">{giveaway.title}</div>
              <div className="text-sm text-muted-foreground">{giveaway.description}</div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/60 px-3 py-1">
                  <Clock className="h-3.5 w-3.5" />
                  Expira {expires_label || 'em breve'}
                </span>
                <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/60 px-3 py-1">
                  Termina <span className="ml-1">{new Date(giveaway.endsAt).toLocaleString('pt-BR')}</span>
                </span>
                <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/60 px-3 py-1">
                  Min {giveaway.minChoices ?? '—'} • Max {giveaway.maxChoices ?? '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Suas escolhas (ordem de preferência)</div>
                  <div className="text-xs text-muted-foreground">
                    Reordene usando as setas e salve.
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => save_mutation.mutate()}
                  isLoading={save_mutation.isPending}
                  disabled={!is_count_valid}
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              </div>

              {!is_count_valid && (
                <div className="rounded-xl border border-border/70 bg-surface/60 p-3 text-xs text-yellow-300">
                  Quantidade inválida. Você precisa respeitar Min/Max do sorteio.
                </div>
              )}

              {choices.length === 0 ? (
                <EmptyState title="Nenhuma escolha" description="Adicione itens abaixo." />
              ) : (
                <ol className="space-y-2">
                  {choices.map((choice, idx) => (
                    <li
                      key={`${idx}-${choice}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/40 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                        <div className="truncate text-sm font-semibold">{choice}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => move_choice(idx, -1)}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => move_choice(idx, 1)}
                          disabled={idx === choices.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => remove_choice(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <div className="rounded-2xl border border-border/70 bg-surface/40 p-4 space-y-3">
                <div className="text-sm font-semibold">Adicionar item</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-2">Itens disponíveis</div>
                    <Select value={add_value} onValueChange={setAddValue} placeholder="Selecione...">
                      <option value="" disabled>
                        Selecione...
                      </option>
                      {remaining_options.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="button" variant="outline" onClick={add_choice} disabled={!add_value}>
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground">
            Dica: este link é temporário. Se ele expirar, abra o sorteio no Discord e gere um novo link.
          </div>
        </div>
      )}
    </div>
  )
}
