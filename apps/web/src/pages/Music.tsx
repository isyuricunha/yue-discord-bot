import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Play, Pause, SkipForward, Square, Volume2, RefreshCw, Music as MusicIcon, ListMusic } from 'lucide-react'
import axios from 'axios'
import { getApiUrl } from '../env'
import { useState, useEffect } from 'react'

const API_URL = getApiUrl()

type Track = {
  title: string
  uri: string
  author: string
  duration: number
}

type MusicStatus = {
  hasSession: boolean
  playing: boolean
  paused: boolean
  volume: number
  current: (Track & {
    thumbnail: string | null
    position: number
  }) | null
  queue: Track[]
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function MusicPage() {
  const { guildId } = useParams()
  const queryClient = useQueryClient()
  const [localVolume, setLocalVolume] = useState<number>(100)
  const [isDraggingVolume, setIsDraggingVolume] = useState(false)

  const { data: status, isLoading, isError, refetch } = useQuery<MusicStatus>({
    queryKey: ['music_status', guildId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/guilds/${guildId}/music`)
      return res.data as MusicStatus
    },
    refetchInterval: 2500, // Poll every 2.5s for real-time updates
  })

  // Sync volume state when not dragging
  useEffect(() => {
    if (status && !isDraggingVolume) {
      setLocalVolume(status.volume)
    }
  }, [status, isDraggingVolume])

  const actionMutation = useMutation({
    mutationFn: async (payload: { action: 'pause' | 'resume' | 'skip' | 'stop' | 'volume'; volume?: number }) => {
      const res = await axios.post(`${API_URL}/api/guilds/${guildId}/music/action`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music_status', guildId] })
    },
  })

  const handleAction = (action: 'pause' | 'resume' | 'skip' | 'stop') => {
    actionMutation.mutate({ action })
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDraggingVolume(true)
    setLocalVolume(Number(e.target.value))
  }

  const handleVolumeCommit = () => {
    setIsDraggingVolume(false)
    actionMutation.mutate({ action: 'volume', volume: localVolume })
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !status) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <MusicIcon className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">Ocorreu um erro ao carregar o player.</p>
        <button
          onClick={() => refetch()}
          className="rounded-xl border border-border/80 bg-surface px-4 py-2 text-sm font-medium hover:bg-surface/70"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!status.hasSession) {
    return (
      <div className="flex h-[calc(100vh-6rem)] flex-col items-center justify-center space-y-4 p-8">
        <div className="rounded-full bg-surface/50 p-6 border border-border/50">
          <MusicIcon className="h-16 w-16 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-bold">Nenhuma sessão ativa</h2>
        <p className="text-center text-muted-foreground max-w-md">
          O bot não está tocando música neste servidor no momento. Entre em um canal de voz e use o comando <code className="rounded bg-surface/80 px-1 py-0.5">/play</code> no Discord para começar.
        </p>
      </div>
    )
  }

  const { current, queue } = status

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ListMusic className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">Player de Música</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Now Playing Widget */}
        <div className="md:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/40 shadow-sm backdrop-blur-md">
            {current ? (
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                  {current.thumbnail ? (
                    <img 
                      src={current.thumbnail} 
                      alt="Thumbnail" 
                      className="h-48 w-48 rounded-xl object-cover shadow-md border border-border/50"
                    />
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-background/50 border border-border/50">
                      <MusicIcon className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                  )}
                  
                  <div className="flex-1 space-y-4 text-center md:text-left w-full">
                    <div>
                      <h2 className="line-clamp-2 text-xl font-bold leading-tight" title={current.title}>
                        <a href={current.uri} target="_blank" rel="noreferrer" className="hover:underline">
                          {current.title}
                        </a>
                      </h2>
                      <p className="text-muted-foreground mt-1">{current.author}</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-background/80">
                        <div 
                          className="h-full bg-accent transition-all duration-1000 ease-linear"
                          style={{ width: `${Math.min(100, (current.position / current.duration) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>{formatDuration(current.position)}</span>
                        <span>{formatDuration(current.duration)}</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center md:justify-start gap-4 pt-4">
                      <button
                        onClick={() => handleAction('stop')}
                        disabled={actionMutation.isPending}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/80 text-muted-foreground transition hover:bg-surface/100 hover:text-foreground hover:scale-105 active:scale-95 disabled:opacity-50"
                        title="Parar"
                      >
                        <Square className="h-4 w-4 fill-current" />
                      </button>
                      
                      <button
                        onClick={() => handleAction(status.paused ? 'resume' : 'pause')}
                        disabled={actionMutation.isPending}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_0_15px_rgba(255,106,0,0.3)] transition hover:bg-accent/90 hover:scale-105 active:scale-95 disabled:opacity-50"
                        title={status.paused ? "Retomar" : "Pausar"}
                      >
                        {status.paused ? (
                          <Play className="h-6 w-6 fill-current ml-1" />
                        ) : (
                          <Pause className="h-6 w-6 fill-current" />
                        )}
                      </button>

                      <button
                        onClick={() => handleAction('skip')}
                        disabled={actionMutation.isPending}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/80 text-muted-foreground transition hover:bg-surface/100 hover:text-foreground hover:scale-105 active:scale-95 disabled:opacity-50"
                        title="Pular"
                      >
                        <SkipForward className="h-4 w-4 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="mt-8 flex items-center gap-4 rounded-xl bg-background/30 p-4 border border-border/40">
                  <Volume2 className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="range"
                    min="1"
                    max="150"
                    value={localVolume}
                    onChange={handleVolumeChange}
                    onMouseUp={handleVolumeCommit}
                    onTouchEnd={handleVolumeCommit}
                    className="h-2 w-full flex-1 appearance-none rounded-full bg-surface/80 outline-none
                      [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full 
                      [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span className="w-8 text-right text-xs font-medium text-muted-foreground bg-surface/50 px-2 py-1 rounded-md">
                    {localVolume}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center space-y-2 p-6">
                 <MusicIcon className="h-10 w-10 text-muted-foreground/50" />
                 <p className="text-muted-foreground font-medium">Buscando próxima faixa...</p>
              </div>
            )}
          </div>
        </div>

        {/* Queue List */}
        <div className="md:col-span-5">
          <div className="flex h-[500px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface/40 shadow-sm backdrop-blur-md">
            <div className="border-b border-border/50 bg-surface/50 px-5 py-4 flex justify-between items-center">
              <h3 className="font-semibold">Fila de Reprodução</h3>
              <span className="text-xs font-medium text-muted-foreground bg-background/80 px-2 py-1 rounded-md">
                {queue.length} {queue.length === 1 ? 'faixa' : 'faixas'}
              </span>
            </div>
            
            <div className="scrollbar-yue flex-1 overflow-y-auto p-2">
              {queue.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-3 p-4 text-center">
                  <ListMusic className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">A fila está vazia.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {queue.map((track, idx) => (
                    <div
                      key={`${track.uri}-${idx}`}
                      className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface/60"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/50 text-xs font-semibold text-muted-foreground border border-border/30">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground" title={track.title}>
                          {track.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {track.author}
                        </p>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground bg-surface/50 px-2 py-1 rounded-md">
                        {formatDuration(track.duration)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
