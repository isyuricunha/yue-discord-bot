import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Settings as SettingsIcon } from 'lucide-react'

import { getApiUrl } from '../env'
import { Card, CardContent, ErrorState, Input, Select, Skeleton, Button, Textarea } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'
import { z } from 'zod'

const API_URL = getApiUrl()

const embed_field_schema = z.object({
  name: z.string(),
  value: z.string(),
  inline: z.boolean().optional(),
})

const embed_schema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    url: z.string().optional(),
    color: z.number().int().optional(),
    fields: z.array(embed_field_schema).optional(),
    author: z.object({ name: z.string().optional(), icon_url: z.string().optional(), url: z.string().optional() }).optional(),
    footer: z.object({ text: z.string().optional(), icon_url: z.string().optional() }).optional(),
    thumbnail: z.object({ url: z.string().optional() }).optional(),
    image: z.object({ url: z.string().optional() }).optional(),
  })
  .strict()

const extended_message_schema = z.object({ content: z.string().optional(), embed: embed_schema.optional() }).strict()

function validate_extended_template(template: string): string | null {
  const trimmed = template.trim()
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) return null

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const validated = extended_message_schema.safeParse(parsed)
    if (validated.success) return null
    return validated.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ')
  } catch (error) {
    const err = error as Error
    return err.message
  }
}

interface GuildConfig {
  prefix: string
  locale: string
  timezone: string
  modLogChannelId?: string
  giveawayChannelId?: string
  welcomeChannelId?: string
  leaveChannelId?: string
  welcomeMessage?: string | null
  leaveMessage?: string | null
  modLogMessage?: string | null
  muteRoleId?: string
}

export default function SettingsPage() {
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

  const [prefix, setPrefix] = useState('')
  const [locale, setLocale] = useState('pt-BR')
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [modLogChannelId, setModLogChannelId] = useState('')
  const [giveawayChannelId, setGiveawayChannelId] = useState('')
  const [welcomeChannelId, setWelcomeChannelId] = useState('')
  const [leaveChannelId, setLeaveChannelId] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [leaveMessage, setLeaveMessage] = useState('')
  const [modLogMessage, setModLogMessage] = useState('')
  const [muteRoleId, setMuteRoleId] = useState('')

  const has_initialized = useRef(false)

  const config = guild?.guild?.config as GuildConfig | undefined

  // Buscar canais da guild
  const { isLoading: is_channels_loading } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return response.data
    },
  })

  useEffect(() => {
    if (!config) return

    if (has_initialized.current) return
    has_initialized.current = true

    setPrefix(config.prefix || '/')
    setLocale(config.locale || 'pt-BR')
    setTimezone(config.timezone || 'America/Sao_Paulo')
    setModLogChannelId(config.modLogChannelId || '')
    setGiveawayChannelId(config.giveawayChannelId || '')
    setWelcomeChannelId(config.welcomeChannelId || '')
    setLeaveChannelId(config.leaveChannelId || '')
    setWelcomeMessage(config.welcomeMessage || '')
    setLeaveMessage(config.leaveMessage || '')
    setModLogMessage(config.modLogMessage || '')
    setMuteRoleId(config.muteRoleId || '')
  }, [config])

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<GuildConfig>) => {
      const response = await axios.put(`${API_URL}/api/guilds/${guildId}/config`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId] })
      toast_success('Configurações salvas com sucesso!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      prefix,
      locale,
      timezone,
      modLogChannelId: modLogChannelId || undefined,
      giveawayChannelId: giveawayChannelId || undefined,
      welcomeChannelId: welcomeChannelId || undefined,
      leaveChannelId: leaveChannelId || undefined,
      welcomeMessage: welcomeMessage || null,
      leaveMessage: leaveMessage || null,
      modLogMessage: modLogMessage || null,
      muteRoleId: muteRoleId || undefined,
    })
  }

  const welcome_validation = useMemo(() => {
    if (!welcomeMessage.trim()) return null
    return validate_extended_template(welcomeMessage)
  }, [welcomeMessage])

  const leave_validation = useMemo(() => {
    if (!leaveMessage.trim()) return null
    return validate_extended_template(leaveMessage)
  }, [leaveMessage])

  const modlog_validation = useMemo(() => {
    if (!modLogMessage.trim()) return null
    return validate_extended_template(modLogMessage)
  }, [modLogMessage])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <SettingsIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Configurações</div>
            <div className="text-sm text-muted-foreground">Preferências do servidor</div>
          </div>
        </div>

        <Button onClick={handleSave} isLoading={updateMutation.isPending} className="shrink-0">
          <Save className="h-4 w-4" />
          <span>Salvar</span>
        </Button>
      </div>

      {is_guild_error && (
        <ErrorState
          title="Falha ao carregar configurações"
          description="Não foi possível carregar os dados do servidor."
          onAction={() => refetch_guild()}
        />
      )}

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Prefixo dos comandos</div>
              <div className="mt-2">
                {is_guild_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    maxLength={5}
                    placeholder="/"
                  />
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Prefixo usado para comandos do bot.</div>
            </div>

            <div>
              <div className="text-sm font-medium">Idioma</div>
              <div className="mt-2">
                {is_guild_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select value={locale} onValueChange={(value) => setLocale(value)}>
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español</option>
                  </Select>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Fuso horário</div>
              <div className="mt-2">
                {is_guild_loading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select value={timezone} onValueChange={(value) => setTimezone(value)}>
                    <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                    <option value="America/New_York">New York (EST)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                  </Select>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border/80 pt-6">
            <div className="text-sm font-semibold">Canais do sistema</div>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal de logs de moderação</div>
                <div className="mt-2">
                  {is_channels_loading ? <Skeleton className="h-11 w-full" /> : <Input value={modLogChannelId} onChange={(e) => setModLogChannelId(e.target.value)} />}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Canal de sorteios</div>
                <div className="mt-2">
                  {is_channels_loading ? <Skeleton className="h-11 w-full" /> : <Input value={giveawayChannelId} onChange={(e) => setGiveawayChannelId(e.target.value)} />}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Canal de boas-vindas</div>
                <div className="mt-2">
                  {is_channels_loading ? <Skeleton className="h-11 w-full" /> : <Input value={welcomeChannelId} onChange={(e) => setWelcomeChannelId(e.target.value)} />}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Canal de saída</div>
                <div className="mt-2">
                  {is_channels_loading ? <Skeleton className="h-11 w-full" /> : <Input value={leaveChannelId} onChange={(e) => setLeaveChannelId(e.target.value)} />}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/80 pt-6">
            <div className="text-sm font-semibold">Mensagens automáticas</div>
            <div className="mt-4 grid grid-cols-1 gap-6">
              <div>
                <div className="text-sm font-medium">Mensagem de boas-vindas</div>
                <div className="mt-2">
                  {is_guild_loading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <Textarea
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      placeholder="Texto ou JSON (content + embed). Ex: Olá {@user}!"
                      rows={5}
                    />
                  )}
                </div>
                {welcome_validation && (
                  <div className="mt-2 text-xs text-red-500">JSON inválido: {welcome_validation}</div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Suporta placeholders e JSON com embed.
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Mensagem de saída</div>
                <div className="mt-2">
                  {is_guild_loading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <Textarea
                      value={leaveMessage}
                      onChange={(e) => setLeaveMessage(e.target.value)}
                      placeholder="Texto ou JSON (content + embed). Ex: {user} saiu do servidor."
                      rows={5}
                    />
                  )}
                </div>
                {leave_validation && (
                  <div className="mt-2 text-xs text-red-500">JSON inválido: {leave_validation}</div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Suporta placeholders e JSON com embed.
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/80 pt-6">
            <div className="text-sm font-semibold">Moderação</div>
            <div className="mt-4 grid grid-cols-1 gap-6">
              <div>
                <div className="text-sm font-medium">Template do Mod Log</div>
                <div className="mt-2">
                  {is_guild_loading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <Textarea
                      value={modLogMessage}
                      onChange={(e) => setModLogMessage(e.target.value)}
                      placeholder="Texto ou JSON (content + embed). Ex: {user.tag} | {punishment}"
                      rows={5}
                    />
                  )}
                </div>
                {modlog_validation && (
                  <div className="mt-2 text-xs text-red-500">JSON inválido: {modlog_validation}</div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Suporta placeholders e JSON com embed.
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/80 pt-6">
            <div className="text-sm font-semibold">Cargos do sistema</div>
            <div className="mt-4">
              <div className="text-sm font-medium">Cargo de mute</div>
              <div className="mt-2">
                {is_guild_loading ? <Skeleton className="h-11 w-full" /> : <Input value={muteRoleId} onChange={(e) => setMuteRoleId(e.target.value)} />}
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
