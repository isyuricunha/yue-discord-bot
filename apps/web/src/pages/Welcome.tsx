import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Select, Skeleton } from '../components/ui'
import { MessageVariantEditor } from '../components/message_variant_editor'
import { PlaceholderChips } from '../components/template_placeholders'
import { validate_extended_template_variants } from '../lib/message_template'
import { toast_error, toast_success } from '../store/toast'

import template_placeholders from '@yuebot/shared/template_placeholders'

const API_URL = getApiUrl()

type api_channel = {
  id: string
  name: string
  type: number
}

type guild_config = {
  welcomeChannelId?: string | null
  leaveChannelId?: string | null
  welcomeMessage?: string | null
  leaveMessage?: string | null
}

function channel_label(channel: api_channel) {
  return `#${channel.name}`
}

export default function WelcomePage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const {
    data: guild,
    isLoading: is_guild_loading,
    isError: is_guild_error,
    refetch: refetch_guild,
  } = useQuery({
    queryKey: ['guild', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}`)
      return response.data
    },
  })

  const config = guild?.guild?.config as guild_config | undefined

  const { data: channels_data, isLoading: is_channels_loading } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return response.data as { channels: api_channel[] }
    },
  })

  const available_channels = useMemo(() => {
    const channels = channels_data?.channels ?? []
    return channels.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [channels_data])

  const [welcome_channel_id, set_welcome_channel_id] = useState('')
  const [leave_channel_id, set_leave_channel_id] = useState('')
  const [welcome_message, set_welcome_message] = useState('')
  const [leave_message, set_leave_message] = useState('')

  const has_initialized = useRef(false)

  useEffect(() => {
    if (!config) return
    if (has_initialized.current) return
    has_initialized.current = true

    set_welcome_channel_id(config.welcomeChannelId ?? '')
    set_leave_channel_id(config.leaveChannelId ?? '')
    set_welcome_message(config.welcomeMessage ?? '')
    set_leave_message(config.leaveMessage ?? '')
  }, [config])

  const welcome_validation = useMemo(() => {
    return validate_extended_template_variants(welcome_message)
  }, [welcome_message])

  const leave_validation = useMemo(() => {
    return validate_extended_template_variants(leave_message)
  }, [leave_message])

  const has_errors = Boolean(welcome_validation) || Boolean(leave_validation)

  const saveMutation = useMutation({
    mutationFn: async () => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/config`, {
        welcomeChannelId: welcome_channel_id || undefined,
        leaveChannelId: leave_channel_id || undefined,
        welcomeMessage: welcome_message || null,
        leaveMessage: leave_message || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-semibold tracking-tight">Boas-vindas</div>
          <div className="mt-1 text-sm text-muted-foreground">Mensagens e canais automáticos</div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending}
          disabled={is_guild_loading || is_guild_error || is_channels_loading || has_errors}
          className="shrink-0"
        >
          <Save className="h-4 w-4" />
          <span>Salvar</span>
        </Button>
      </div>

      {is_guild_error && (
        <ErrorState
          title="Falha ao carregar configurações"
          description="Não foi possível carregar os dados do servidor."
          onAction={() => void refetch_guild()}
        />
      )}

      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <div className="text-sm font-semibold">Canais</div>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal de boas-vindas</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={welcome_channel_id} onValueChange={(value) => set_welcome_channel_id(value)}>
                      <option value="">Desativado</option>
                      {available_channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channel_label(ch)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Canal de saída</div>
                <div className="mt-2">
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={leave_channel_id} onValueChange={(value) => set_leave_channel_id(value)}>
                      <option value="">Desativado</option>
                      {available_channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {channel_label(ch)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/80 pt-6">
            <div className="text-sm font-semibold">Mensagens</div>
            <div className="mt-4 grid grid-cols-1 gap-6">
              {is_guild_loading ? (
                <>
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </>
              ) : (
                <>
                  <MessageVariantEditor
                    label="Mensagem de boas-vindas"
                    description="Você pode criar várias mensagens (o bot escolhe uma aleatória). Cada item pode ser texto simples ou JSON (content + embed)."
                    value={welcome_message}
                    onChange={set_welcome_message}
                    placeholder="Ex: Olá {@user}!"
                    rows={5}
                  />

                  {welcome_validation && <div className="text-xs text-red-500">Template inválido: {welcome_validation}</div>}

                  <MessageVariantEditor
                    label="Mensagem de saída"
                    description="Você pode criar várias mensagens (o bot escolhe uma aleatória). Cada item pode ser texto simples ou JSON (content + embed)."
                    value={leave_message}
                    onChange={set_leave_message}
                    placeholder="Ex: {user} saiu do servidor."
                    rows={5}
                  />

                  {leave_validation && <div className="text-xs text-red-500">Template inválido: {leave_validation}</div>}

                  <div className="rounded-2xl border border-border/70 bg-surface/40 p-4 text-sm text-muted-foreground">
                    <div className="text-sm font-semibold text-foreground">Exemplos</div>
                    <div className="mt-2 space-y-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Placeholders</div>
                        <PlaceholderChips placeholders={template_placeholders.welcome_template_placeholders} />
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-border/70 bg-surface/60 px-3 py-3">
                          <div className="text-xs font-semibold text-foreground">Texto simples</div>
                          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-foreground">
                            {'Bem-vindo {@user} ao {guild}! Agora somos {guild-size} membros.'}
                          </pre>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-surface/60 px-3 py-3">
                          <div className="text-xs font-semibold text-foreground">JSON (content + embed)</div>
                          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-foreground">
{JSON.stringify(
  {
    content: '{@user}',
    embed: {
      title: 'Bem-vindo(a)!',
      description: '{user.tag} entrou no {guild}',
      color: 16742144,
    },
  },
  null,
  2
)}</pre>
                        </div>
                      </div>

                      <div className="text-xs">
                        Dica: você pode criar várias mensagens (o bot escolhe uma aleatória). Cada item da lista pode ser texto simples ou JSON.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-accent/20">
        <CardContent className="p-6 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-foreground">Nota:</span> Alterações podem levar alguns segundos para refletir no bot.
            </div>
            <div>
              <span className="font-semibold text-foreground">Dica:</span> Para obter IDs no Discord, ative o modo desenvolvedor e use “Copiar ID”.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
