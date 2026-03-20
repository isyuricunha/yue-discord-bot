import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Settings, Shield, Trophy, Plus } from 'lucide-react'

import { getApiUrl, getDiscordClientId } from '../env'
import { Card, CardContent, Skeleton, Button } from '../components/ui'
import { useAuthStore } from '../store/auth'

const API_URL = getApiUrl()

function buildInviteUrl(clientId: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions: '0',
  })
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

interface Guild {
  id: string
  name: string
  icon: string | null
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const clientId = getDiscordClientId()
  const inviteUrl = clientId ? buildInviteUrl(clientId) : null

  const { data: guilds, isLoading } = useQuery({
    queryKey: ['guilds'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds`)
      return response.data.guilds as Guild[]
    },
  })

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Seus servidores</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {user?.isOwner
              ? 'Você está em modo owner - acesso total aos servidores onde o bot está instalado.'
              : `Selecione um servidor para gerenciar. Use ${typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win') ? 'Ctrl+K' : '⌘K'} para buscar rapidamente.`}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-10 px-0 sm:w-auto sm:px-3"
          onClick={() => inviteUrl ? window.open(inviteUrl, '_blank') : undefined}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Adicionar servidor</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guilds?.map((guild) => (
            <Card
              key={guild.id}
              className="group cursor-pointer transition-colors hover:border-accent/40"
              onClick={() => navigate(`/guild/${guild.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {guild.icon ? (
                    <img
                      src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                      alt={guild.name}
                      className="h-14 w-14 rounded-2xl"
                    />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border/80 bg-surface/70 text-lg font-semibold">
                      <span className="text-accent">{guild.name.charAt(0)}</span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold tracking-tight group-hover:text-foreground">
                      {guild.name}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">Clique para abrir</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border/70 bg-surface/50 p-3 text-center">
                    <Shield className="mx-auto h-4 w-4 text-accent" />
                    <div className="mt-1 text-[11px] text-muted-foreground">AutoMod</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface/50 p-3 text-center">
                    <Trophy className="mx-auto h-4 w-4 text-accent" />
                    <div className="mt-1 text-[11px] text-muted-foreground">Sorteios</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface/50 p-3 text-center">
                    <Settings className="mx-auto h-4 w-4 text-accent" />
                    <div className="mt-1 text-[11px] text-muted-foreground">Config</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && guilds?.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface/60">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-base font-semibold">Nenhum servidor encontrado</div>
            <div className="mt-2 text-sm text-muted-foreground">
              {user?.isOwner
                ? 'O bot ainda não sincronizou nenhum servidor no banco. Verifique se ele está online e conectado.'
                : 'Convide o bot para seus servidores onde você é administrador.'}
            </div>
            {!user?.isOwner && (
              <Button
                className="mt-4"
                onClick={() => inviteUrl ? window.open(inviteUrl, '_blank') : undefined}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar bot ao servidor
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
