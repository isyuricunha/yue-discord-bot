import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, ErrorState, Select, Skeleton, Textarea } from '../components/ui'
import { validate_extended_template } from '../lib/message_template'
import { toast_error, toast_success } from '../store/toast'

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
    if (!welcome_message.trim()) return null
    return validate_extended_template(welcome_message)
  }, [welcome_message])

  const leave_validation = useMemo(() => {
    if (!leave_message.trim()) return null
    return validate_extended_template(leave_message)
  }, [leave_message])

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

  const has_errors = Boolean(welcome_validation) || Boolean(leave_validation)

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
              <div>
                <div className="text-sm font-medium">Mensagem de boas-vindas</div>
                <div className="mt-2">
                  {is_guild_loading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <Textarea
                      value={welcome_message}
                      onChange={(e) => set_welcome_message(e.target.value)}
                      placeholder="Texto ou JSON (content + embed). Ex: Olá {@user}!"
                      rows={5}
                    />
                  )}
                </div>
                {welcome_validation && <div className="mt-2 text-xs text-red-500">JSON inválido: {welcome_validation}</div>}
                <div className="mt-2 text-xs text-muted-foreground">Suporta placeholders e JSON com embed.</div>
              </div>

              <div>
                <div className="text-sm font-medium">Mensagem de saída</div>
                <div className="mt-2">
                  {is_guild_loading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <Textarea
                      value={leave_message}
                      onChange={(e) => set_leave_message(e.target.value)}
                      placeholder="Texto ou JSON (content + embed). Ex: {user} saiu do servidor."
                      rows={5}
                    />
                  )}
                </div>
                {leave_validation && <div className="mt-2 text-xs text-red-500">JSON inválido: {leave_validation}</div>}
                <div className="mt-2 text-xs text-muted-foreground">Suporta placeholders e JSON com embed.</div>
              </div>
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
