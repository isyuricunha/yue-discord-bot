import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Plus, Radio, Trash2 } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Input, Select, Skeleton, Switch, Textarea } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

const ALLOWED_DOMAINS = [
  'tenor.com',
  'giphy.com',
  'imgur.com',
  'i.imgur.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
]
const ALLOWED_EXTENSIONS = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4']

function validate_media_url(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'URL inválida.'
  }
  if (url.protocol !== 'https:') return 'A URL deve começar com https://.'

  const hostname = url.hostname.toLowerCase()
  const is_allowed_domain = ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  )
  if (is_allowed_domain) return null

  const path = url.pathname.split('?')[0] ?? ''
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (ALLOWED_EXTENSIONS.includes(ext)) return null

  return `Domínio não permitido. Use URLs de tenor.com, giphy.com, imgur.com, i.imgur.com, cdn.discordapp.com, media.discordapp.net — ou URLs com extensão .gif, .png, .jpg, .jpeg, .webp, .mp4.`
}

type api_channel = { id: string; name: string; type: number }

type keyword_trigger = {
  id: string
  keyword: string
  mediaUrl: string
  channelId: string | null
  createdBy: string
  content: string | null
  replyToUser: boolean
  createdAt: string
}

const CHANNEL_TYPE_GUILD_TEXT = 0
const CHANNEL_TYPE_GUILD_ANNOUNCEMENT = 5

export default function KeywordTriggersPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [channelId, setChannelId] = useState('')
  const [replyToUser, setReplyToUser] = useState(true)
  const [url_error, set_url_error] = useState<string | null>(null)

  const { data: channels_data, isLoading: is_channels_loading } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return res.data as { success: boolean; channels: api_channel[] }
    },
  })

  const {
    data: triggers_data,
    isLoading: is_triggers_loading,
    isError: is_triggers_error,
    refetch,
  } = useQuery({
    queryKey: ['triggers', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/triggers`)
      return res.data as { success: boolean; triggers: keyword_trigger[] }
    },
  })

  const text_channels = (channels_data?.channels ?? []).filter(
    (c) => c.type === CHANNEL_TYPE_GUILD_TEXT || c.type === CHANNEL_TYPE_GUILD_ANNOUNCEMENT
  )

  const channel_by_id = new Map((channels_data?.channels ?? []).map((c) => [c.id, c]))

  const create_mutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_URL}/api/guilds/${guildId}/triggers`, {
        keyword: keyword.trim(),
        mediaUrl: url.trim() || null,
        content: content.trim() || null,
        channelId: channelId || null,
        replyToUser,
      })
    },
    onSuccess: () => {
      toast_success('Gatilho adicionado com sucesso!')
      setKeyword('')
      setContent('')
      setUrl('')
      setChannelId('')
      setReplyToUser(true)
      set_url_error(null)
      void queryClient.invalidateQueries({ queryKey: ['triggers', guildId] })
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao adicionar gatilho.')
    },
  })

  const delete_mutation = useMutation({
    mutationFn: async (triggerId: string) => {
      await axios.delete(`${API_URL}/api/guilds/${guildId}/triggers/${triggerId}`)
    },
    onSuccess: () => {
      toast_success('Gatilho removido.')
      void queryClient.invalidateQueries({ queryKey: ['triggers', guildId] })
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao remover gatilho.')
    },
  })

  function handle_url_change(value: string) {
    setUrl(value)
    if (value.trim()) {
      set_url_error(validate_media_url(value.trim()))
    } else {
      set_url_error(null)
    }
  }

  function handle_submit() {
    if (!keyword.trim()) {
      toast_error('Informe a palavra-chave.')
      return
    }
    if (!url.trim() && !content.trim()) {
      toast_error('Informe pelo menos uma URL ou uma Mensagem.')
      return
    }
    const err = url.trim() ? validate_media_url(url.trim()) : null
    if (err) {
      set_url_error(err)
      return
    }
    create_mutation.mutate()
  }

  const triggers = triggers_data?.triggers ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
          <Radio className="h-5 w-5 text-accent" />
        </div>
        <div>
          <div className="text-xl font-semibold tracking-tight">Gatilhos</div>
          <div className="text-sm text-muted-foreground">
            Auto-resposta com GIF ou imagem por palavra-chave
          </div>
        </div>
      </div>

      {/* Add form */}
      <Card className="border-accent/20">
        <CardContent className="space-y-4 p-6">
          <div className="text-sm font-semibold">Adicionar gatilho</div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Palavra-chave</div>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="ex: bom dia"
                maxLength={100}
              />
            </div>

            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Mensagem (Texto)</div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que o bot deve dizer..."
              className="resize-none"
              rows={3}
            />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">URL da mídia (opcional)</div>
            <Input
              value={url}
              onChange={(e) => handle_url_change(e.target.value)}
              placeholder="https://media.tenor.com/..."
              className={url_error ? 'border-red-500 focus:border-red-500' : ''}
            />
            {url_error && <div className="mt-1 text-xs text-red-400">{url_error}</div>}
            <div className="mt-1 text-[11px] text-muted-foreground">
              Domínios aceitos: tenor.com, giphy.com, imgur.com, cdn.discordapp.com,
              media.discordapp.net — ou qualquer URL com extensão .gif, .png, .jpg, .jpeg, .webp,
              .mp4
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-surface/20 p-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Responder à mensagem</div>
              <div className="text-xs text-muted-foreground">
                Menciona quem ativou o gatilho ao enviar a mídia
              </div>
            </div>
            <Switch checked={replyToUser} onCheckedChange={setReplyToUser} />
          </div>

          {/* Preview */}
          {url && !url_error && (
            <div className="rounded-2xl border border-accent/20 bg-surface/40 p-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Preview da mídia
              </div>
              <img
                src={url}
                alt="Preview"
                className="max-h-48 rounded-xl object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handle_submit}
              isLoading={create_mutation.isPending}
              disabled={!keyword.trim() || (!url.trim() && !content.trim()) || !!url_error}
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Triggers list */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              Gatilhos configurados
              {triggers.length > 0 && (
                <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  {triggers.length}
                </span>
              )}
            </div>
          </div>

          {is_triggers_loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : is_triggers_error ? (
            <ErrorState
              title="Erro ao carregar gatilhos"
              description="Não foi possível buscar a lista de gatilhos."
              actionLabel="Tentar novamente"
              onAction={() => void refetch()}
            />
          ) : triggers.length === 0 ? (
            <EmptyState
              title="Nenhum gatilho configurado"
              description="Adicione uma palavra-chave e uma URL de mídia para criar o primeiro gatilho."
            />
          ) : (
            <div className="space-y-2">
              {triggers.map((t) => {
                const channel = t.channelId ? channel_by_id.get(t.channelId) : null
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-4 rounded-2xl border border-border/70 bg-surface/40 px-4 py-3 transition-colors hover:bg-surface/60"
                  >
                    {/* Thumbnail preview */}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-surface/80">
                      {t.mediaUrl ? (
                        <img
                          src={t.mediaUrl}
                          alt={t.keyword}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                          <Radio className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                          {t.keyword}
                        </span>
                        {channel ? (
                          <span className="text-xs text-muted-foreground">
                            #{channel.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          {t.replyToUser ? 'Responde' : 'Envia'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-col gap-0.5">
                        {t.content && (
                          <div className="truncate text-xs text-foreground/80 line-clamp-1">
                            {t.content}
                          </div>
                        )}
                        <div className="truncate text-[10px] text-muted-foreground/60 italic">
                          {t.mediaUrl ? (
                            t.mediaUrl.length > 60 ? `${t.mediaUrl.slice(0, 57)}…` : t.mediaUrl
                          ) : (
                            'Apenas texto'
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm(`Remover o gatilho "${t.keyword}"?`)) return
                        delete_mutation.mutate(t.id)
                      }}
                      className="shrink-0 text-muted-foreground hover:text-red-400"
                      aria-label={`Remover gatilho ${t.keyword}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
