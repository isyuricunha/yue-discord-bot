import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Save, Star } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, EmptyState, ErrorState, Input, Select, Skeleton, Switch } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'

const API_URL = getApiUrl()

type api_channel = {
  id: string
  name: string
  type: number
}

type starboard_config = {
  enabled: boolean
  channelId: string | null
  emoji: string
  threshold: number
  ignoreBots: boolean
}

type api_starboard_post = {
  id: string
  sourceChannelId: string
  sourceMessageId: string
  starboardChannelId: string
  starboardMessageId: string
  authorId: string
  starCount: number
  createdAt: string
  updatedAt: string
}

function channel_label(ch: api_channel) {
  return `#${ch.name}`
}

const CHANNEL_TYPE_GUILD_TEXT = 0
const CHANNEL_TYPE_GUILD_ANNOUNCEMENT = 5

export default function StarboardPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()
  const has_initialized = useRef(false)

  const [config, set_config] = useState<starboard_config | null>(null)

  const {
    data: channels_data,
    isLoading: is_channels_loading,
    isError: is_channels_error,
    refetch: refetch_channels,
  } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/channels`)
      return res.data as { success: boolean; channels: api_channel[] }
    },
  })

  const {
    data: config_data,
    isLoading: is_config_loading,
    isError: is_config_error,
    refetch: refetch_config,
  } = useQuery({
    queryKey: ['starboard-config', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/starboard-config`)
      return res.data as { success: boolean; config: starboard_config }
    },
  })

  useEffect(() => {
    if (!config_data?.config) return
    if (has_initialized.current) return
    has_initialized.current = true

    set_config({
      enabled: Boolean(config_data.config.enabled),
      channelId: config_data.config.channelId ?? null,
      emoji: config_data.config.emoji ?? '⭐',
      threshold: typeof config_data.config.threshold === 'number' ? config_data.config.threshold : 3,
      ignoreBots: Boolean(config_data.config.ignoreBots),
    })
  }, [config_data])

  const channels = useMemo(() => {
    const list = channels_data?.channels ?? []
    return list.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [channels_data])

  const text_channels = useMemo(
    () => channels.filter((c) => c.type === CHANNEL_TYPE_GUILD_TEXT || c.type === CHANNEL_TYPE_GUILD_ANNOUNCEMENT),
    [channels]
  )

  const save_mutation = useMutation({
    mutationFn: async (payload: starboard_config) => {
      await axios.put(`${API_URL}/api/guilds/${guildId}/starboard-config`, {
        enabled: payload.enabled,
        channelId: payload.channelId,
        emoji: payload.emoji,
        threshold: payload.threshold,
        ignoreBots: payload.ignoreBots,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['starboard-config', guildId] })
      toast_success('Configurações salvas!')
    },
    onError: (error: any) => {
      toast_error(error.response?.data?.error || error.message || 'Erro ao salvar configurações')
    },
  })

  const posts_query = useInfiniteQuery({
    queryKey: ['starboard-posts', guildId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit: 25 }
      if (typeof pageParam === 'string' && pageParam) params.cursor = pageParam

      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/starboard/posts`, { params })
      return res.data as { success: boolean; posts: api_starboard_post[]; nextCursor: string | null }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const all_posts = useMemo(() => {
    const pages = posts_query.data?.pages ?? []
    return pages.flatMap((p) => p.posts ?? [])
  }, [posts_query.data])

  const is_loading = is_channels_loading || is_config_loading
  const is_error = is_channels_error || is_config_error

  const handle_save = () => {
    if (!config) return
    const threshold = Math.max(1, Math.min(50, Math.floor(config.threshold)))
    const emoji = (config.emoji || '⭐').trim()

    save_mutation.mutate({
      ...config,
      threshold,
      emoji,
    })
  }

  const is_save_disabled =
    !config ||
    is_loading ||
    (config.enabled && (!config.channelId || config.channelId.trim().length === 0)) ||
    (config.emoji ?? '').trim().length === 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
            <Star className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Starboard</div>
            <div className="text-sm text-muted-foreground">Reposte mensagens populares com estrelas</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => {
              refetch_channels()
              refetch_config()
              posts_query.refetch()
            }}
          >
            Atualizar
          </Button>

          <Button onClick={handle_save} isLoading={save_mutation.isPending} disabled={is_save_disabled} className="shrink-0">
            <Save className="h-4 w-4" />
            <span>Salvar</span>
          </Button>
        </div>
      </div>

      {is_error && (
        <ErrorState
          title="Erro ao carregar starboard"
          description="Não foi possível carregar canais/configuração do starboard."
          actionLabel="Tentar novamente"
          onAction={() => {
            refetch_channels()
            refetch_config()
          }}
        />
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Ativar starboard</div>
              <div className="text-xs text-muted-foreground">Quando uma mensagem atingir o limite de reações, ela é repostada.</div>
            </div>

            <Switch checked={Boolean(config?.enabled)} onCheckedChange={(checked) => config && set_config({ ...config, enabled: checked })} disabled={is_loading} />
          </div>

          {is_loading || !config ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Canal do starboard</div>
                <div className="mt-1 text-xs text-muted-foreground">Onde serão repostadas as mensagens.</div>
                <div className="mt-2">
                  <Select value={config.channelId ?? ''} onValueChange={(v) => set_config({ ...config, channelId: v || null })}>
                    <option value="">Selecione um canal</option>
                    {text_channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {channel_label(ch)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Emoji</div>
                <div className="mt-1 text-xs text-muted-foreground">Ex: ⭐, 🌟 ou &lt;:star:123&gt;.</div>
                <div className="mt-2">
                  <Input value={config.emoji} onChange={(e) => set_config({ ...config, emoji: e.target.value })} placeholder="⭐" />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Limite</div>
                <div className="mt-1 text-xs text-muted-foreground">Quantidade mínima de reações para entrar no starboard.</div>
                <div className="mt-2">
                  <Input
                    value={String(config.threshold)}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value || '0', 10)
                      set_config({ ...config, threshold: Number.isNaN(parsed) ? 1 : parsed })
                    }}
                    placeholder="3"
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-surface/30 p-4">
                <div>
                  <div className="text-sm font-medium">Ignorar bots</div>
                  <div className="mt-1 text-xs text-muted-foreground">Não inclui mensagens enviadas por bots.</div>
                </div>

                <Switch checked={config.ignoreBots} onCheckedChange={(checked) => set_config({ ...config, ignoreBots: checked })} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-sm font-semibold">Posts</div>
            <div className="mt-1 text-xs text-muted-foreground">Mensagens que já foram para o starboard.</div>
          </div>

          {posts_query.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : posts_query.isError ? (
            <ErrorState
              title="Erro ao carregar posts"
              description="Não foi possível buscar os posts do starboard."
              actionLabel="Tentar novamente"
              onAction={() => posts_query.refetch()}
            />
          ) : all_posts.length === 0 ? (
            <EmptyState title="Nenhum post ainda" description="Mensagens que entrarem no starboard aparecerão aqui." />
          ) : (
            <div className="space-y-2">
              {all_posts.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        <span className="font-mono">{p.sourceMessageId}</span>
                        <span className="text-muted-foreground"> • </span>
                        <span className="font-mono">{p.starCount}</span>
                        <span className="text-muted-foreground"> estrelas</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Autor: <span className="font-mono">{p.authorId}</span> • Canal: <span className="font-mono">{p.sourceChannelId}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Starboard msg: <span className="font-mono">{p.starboardMessageId}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}

              {posts_query.hasNextPage && (
                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={() => posts_query.fetchNextPage()} isLoading={posts_query.isFetchingNextPage}>
                    <span>Carregar mais</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
