import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Edit2, Plus, Radio, Trash2, X } from 'lucide-react'

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
  keywords?: string[]
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

  // Edit modal state
  const [editing_trigger, set_editing_trigger] = useState<keyword_trigger | null>(null)
  const [edit_keywords, set_edit_keywords] = useState('')
  const [edit_content, set_edit_content] = useState('')
  const [edit_url, set_edit_url] = useState('')
  const [edit_channel_id, set_edit_channel_id] = useState('')
  const [edit_reply_to_user, set_edit_reply_to_user] = useState(true)
  const [edit_url_error, set_edit_url_error] = useState<string | null>(null)

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

  const update_mutation = useMutation({
    mutationFn: async () => {
      if (!editing_trigger) return

      const keywords = edit_keywords
        .split('\n')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0 && k.length <= 100)

      await axios.put(`${API_URL}/api/guilds/${guildId}/triggers/${editing_trigger.id}`, {
        keywords,
        mediaUrl: edit_url.trim() || null,
        content: edit_content.trim() || null,
        channelId: edit_channel_id || null,
        replyToUser: edit_reply_to_user,
      })
    },
    onSuccess: () => {
      toast_success('Gatilho atualizado com sucesso!')
      set_editing_trigger(null)
      void queryClient.invalidateQueries({ queryKey: ['triggers', guildId] })
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao atualizar gatilho.')
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

            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                Canal (opcional)
              </div>
              {is_channels_loading ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <Select value={channelId} onValueChange={setChannelId}>
                  <option value="">Todos os canais</option>
                  {text_channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </Select>
              )}
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
                  ; (e.target as HTMLImageElement).style.display = 'none'
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
                            ; (e.target as HTMLImageElement).style.display = 'none'
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
                        )}
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

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        set_editing_trigger(t)
                        set_edit_keywords(t.keywords ? t.keywords.join('\n') : t.keyword)
                        set_edit_content(t.content || '')
                        set_edit_url(t.mediaUrl || '')
                        set_edit_channel_id(t.channelId || '')
                        set_edit_reply_to_user(t.replyToUser)
                        set_edit_url_error(null)
                      }}
                      className="shrink-0 text-muted-foreground hover:text-accent"
                      aria-label={`Editar gatilho ${t.keyword}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>

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

      {/* Edit Modal */}
      {editing_trigger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-2xl rounded-2xl bg-surface border border-border shadow-xl">
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
              <div className="text-lg font-semibold">Editar Gatilho</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => set_editing_trigger(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Palavras-chave (uma por linha)</div>
                  <Textarea
                    value={edit_keywords}
                    onChange={(e) => set_edit_keywords(e.target.value)}
                    placeholder="ex: bom dia&#10;boa tarde"
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Canal (opcional)
                  </div>
                  {is_channels_loading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : (
                    <Select value={edit_channel_id} onValueChange={set_edit_channel_id}>
                      <option value="">Todos os canais</option>
                      {text_channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          #{c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Mensagem (Texto)</div>
                <Textarea
                  value={edit_content}
                  onChange={(e) => set_edit_content(e.target.value)}
                  placeholder="O que o bot deve dizer..."
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">URL da mídia (opcional)</div>
                <Input
                  value={edit_url}
                  onChange={(e) => {
                    set_edit_url(e.target.value)
                    if (e.target.value.trim()) {
                      set_edit_url_error(validate_media_url(e.target.value.trim()))
                    } else {
                      set_edit_url_error(null)
                    }
                  }}
                  placeholder="https://media.tenor.com/..."
                  className={edit_url_error ? 'border-red-500 focus:border-red-500' : ''}
                />
                {edit_url_error && <div className="mt-1 text-xs text-red-400">{edit_url_error}</div>}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-surface/20 p-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Responder à mensagem</div>
                  <div className="text-xs text-muted-foreground">
                    Menciona quem ativou o gatilho ao enviar a mídia
                  </div>
                </div>
                <Switch checked={edit_reply_to_user} onCheckedChange={set_edit_reply_to_user} />
              </div>

              {/* Preview */}
              {edit_url && !edit_url_error && (
                <div className="rounded-2xl border border-accent/20 bg-surface/40 p-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Preview da mídia
                  </div>
                  <img
                    src={edit_url}
                    alt="Preview"
                    className="max-h-48 rounded-xl object-contain"
                    onError={(e) => {
                      ; (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => set_editing_trigger(null)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => update_mutation.mutate()}
                  isLoading={update_mutation.isPending}
                  disabled={
                    (!edit_keywords.trim() || (edit_keywords.split('\n').every(k => !k.trim()))) ||
                    (!edit_url.trim() && !edit_content.trim()) ||
                    !!edit_url_error
                  }
                >
                  Salvar alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
