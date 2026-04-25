import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Eye, MessageSquare, UserMinus } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, CardHeader, ErrorState, Select, Skeleton, PageHeader, ModuleLayout } from '../components/ui'
import { channel_label } from '../lib/discord'
import { MessageVariantEditor } from '../components/message_variant_editor'
import { PlaceholderChips } from '../components/template_placeholders'
import { validate_extended_template_variants } from '../lib/message_template'
import { toast_error, toast_success } from '../store/toast'
import {
  pick_discord_message_template_variant,
  render_discord_message_template,
} from '@yuebot/shared'
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

type welcome_config_response = {
  success: boolean
  config: {
    welcomeChannelId: string | null
    leaveChannelId: string | null
    welcomeMessage: string | null
    leaveMessage: string | null
  }
}

type preview_type = 'welcome' | 'leave'

// Sample data for preview
const preview_user = {
  id: '123456789012345678',
  username: 'NovoMembro',
  tag: 'NovoMembro#1234',
  avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
  nickname: undefined,
}

const preview_guild = {
  id: '987654321098765432',
  name: 'Meu Servidor Discord',
  memberCount: 150,
  iconUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
}

function render_preview(template: string) {
  if (!template.trim()) {
    return null
  }

  // Pick a variant (use fixed seed for consistent preview)
  const chosen = pick_discord_message_template_variant(template, () => 0.5)

  // Render with preview data
  const rendered = render_discord_message_template(chosen, {
    user: preview_user,
    guild: preview_guild,
  })

  return rendered
}

export default function WelcomePage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const {
    data: config_data,
    isLoading: is_config_loading,
    isError: is_config_error,
    refetch: refetch_config,
  } = useQuery({
    queryKey: ['welcome-config', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/welcome-config`)
      return response.data as welcome_config_response
    },
  })

  const config = (config_data?.config as guild_config | undefined) ?? undefined

  const { data: channels_data, isLoading: is_channels_loading } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return response.data as { success: boolean; channels: api_channel[] }
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
  const [preview_type, set_preview_type] = useState<preview_type>('welcome')
  const [show_preview, set_show_preview] = useState(false)

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

  const current_preview_message = preview_type === 'welcome' ? welcome_message : leave_message
  const preview_rendered = useMemo(() => {
    if (!show_preview) return null
    return render_preview(current_preview_message)
  }, [current_preview_message, show_preview])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/welcome-config`, {
        welcomeChannelId: welcome_channel_id || undefined,
        leaveChannelId: leave_channel_id || undefined,
        welcomeMessage: welcome_message || null,
        leaveMessage: leave_message || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-config', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  return (
    <ModuleLayout maxWidth="4xl">
      <PageHeader
        icon={Save}
        title="Boas-vindas"
        description="Mensagens e canais automáticos"
      >
        <Button
          onClick={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending}
          disabled={is_config_loading || is_config_error || is_channels_loading || has_errors}
          className="shrink-0"
        >
          <Save className="h-4 w-4" />
          <span>Salvar</span>
        </Button>
      </PageHeader>

      {/* Preview Toggle Button */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => set_show_preview(!show_preview)}
          className="shrink-0"
        >
          <Eye className="h-4 w-4" />
          <span>{show_preview ? 'Ocultar visualização' : 'Visualizar mensagem'}</span>
        </Button>
      </div>

      {is_config_error && (
        <ErrorState
          title="Falha ao carregar configurações"
          description="Não foi possível carregar os dados do servidor."
          onAction={() => refetch_config()}
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
                  {is_config_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select
                      value={welcome_channel_id}
                      onValueChange={(value) => set_welcome_channel_id(value)}
                    >
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
                  {is_config_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select
                      value={leave_channel_id}
                      onValueChange={(value) => set_leave_channel_id(value)}
                    >
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
              {is_config_loading ? (
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
                            {"Bem-vindo {@user} ao {guild}! Agora somos {guild-size} membros."}
                          </pre>
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

      {/* Preview Section */}
      {show_preview && (
        <Card className="border-accent/40 bg-accent/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Visualização</div>
              <div className="flex gap-1">
                <Button
                  variant={preview_type === 'welcome' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => set_preview_type('welcome')}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Boas-vindas</span>
                </Button>
                <Button
                  variant={preview_type === 'leave' ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => set_preview_type('leave')}
                >
                  <UserMinus className="h-4 w-4" />
                  <span>Saída</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {preview_rendered ? (
              <div className="rounded-lg border border-border/60 bg-background/80 p-4">
                {/* User info in preview */}
                <div className="mb-3 flex items-center gap-3 border-b border-border/40 pb-3">
                  <img
                    src={preview_user.avatarUrl}
                    alt={preview_user.username}
                    className="h-12 w-12 rounded-full"
                  />
                  <div>
                    <div className="font-semibold">{preview_user.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {preview_guild.name} • {preview_guild.memberCount} membros
                    </div>
                  </div>
                </div>

                {/* Message content */}
                {preview_rendered.content && (
                  <div className="mb-3 whitespace-pre-wrap text-sm">{preview_rendered.content}</div>
                )}

                {/* Embed preview */}
                {preview_rendered.embeds && preview_rendered.embeds[0] && (
                  <div
                    className="rounded-lg border border-border/60 p-3"
                    style={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    {preview_rendered.embeds[0].author && (
                      <div className="mb-2 flex items-center gap-2">
                        {preview_rendered.embeds[0].author.icon_url && (
                          <img
                            src={preview_rendered.embeds[0].author.icon_url}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        )}
                        <span className="text-xs font-semibold">{preview_rendered.embeds[0].author.name}</span>
                      </div>
                    )}
                    {preview_rendered.embeds[0].title && (
                      <div className="text-sm font-semibold" style={{ color: preview_rendered.embeds[0].color ? `#${preview_rendered.embeds[0].color.toString(16).padStart(6, '0')}` : undefined }}>
                        {preview_rendered.embeds[0].title}
                      </div>
                    )}
                    {preview_rendered.embeds[0].description && (
                      <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                        {preview_rendered.embeds[0].description}
                      </div>
                    )}
                    {preview_rendered.embeds[0].thumbnail && (
                      <div className="mt-2">
                        <img
                          src={preview_rendered.embeds[0].thumbnail.url}
                          alt=""
                          className="max-h-32 rounded"
                        />
                      </div>
                    )}
                    {preview_rendered.embeds[0].footer && (
                      <div className="mt-2 border-t border-border/40 pt-2">
                        <div className="flex items-center gap-2">
                          {preview_rendered.embeds[0].footer.icon_url && (
                            <img
                              src={preview_rendered.embeds[0].footer.icon_url}
                              alt=""
                              className="h-4 w-4 rounded-full"
                            />
                          )}
                          <span className="text-xs text-muted-foreground">{preview_rendered.embeds[0].footer.text}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 text-xs text-muted-foreground">
                  Esta é uma visualização com dados de exemplo.
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-background/80 p-6 text-center text-sm text-muted-foreground">
                {preview_type === 'welcome' ? 'Digite uma mensagem de boas-vindas para visualizar.' : 'Digite uma mensagem de saída para visualizar.'}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
    </ModuleLayout>
  )
}