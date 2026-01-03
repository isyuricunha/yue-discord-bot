import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { BarChart3, Shield, Trophy, FileText, Users, Settings, Sparkles, UserPlus, LifeBuoy, Wand2, Lightbulb, MousePointerClick } from 'lucide-react'

import { getApiUrl } from '../env'
import { Card, CardContent, Skeleton } from '../components/ui'

const API_URL = getApiUrl()

interface Guild {
  id: string
  name: string
  icon: string | null
}

export default function GuildPage() {
  const { guildId } = useParams()
  const navigate = useNavigate()

  const { data: guild, isLoading } = useQuery({
    queryKey: ['guild', guildId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/guilds/${guildId}`)
      return response.data.guild as Guild
    },
  })

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          {isLoading ? (
            <Skeleton className="h-14 w-14 rounded-2xl" />
          ) : guild?.icon ? (
            <img
              src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
              alt={guild.name}
              className="h-14 w-14 rounded-2xl"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border/80 bg-surface/70 text-lg font-semibold">
              <span className="text-accent">{guild?.name.charAt(0) ?? '?'}</span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold tracking-tight">
              {isLoading ? <Skeleton className="h-4 w-40" /> : guild?.name ?? 'Guild'}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {isLoading ? <Skeleton className="h-3 w-56" /> : 'Painel de gerenciamento do servidor'}
            </div>
          </div>
        </CardContent>
      </Card>

      {!isLoading && !guild && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-base font-semibold">Servidor não encontrado</div>
              <div className="mt-2 text-sm text-muted-foreground">Verifique se você tem acesso a esta guild.</div>
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer transition-colors hover:border-accent/40"
            onClick={() => navigate(`/guild/${guildId}/reaction-roles`)}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                  <MousePointerClick className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold">Reaction Roles</div>
                  <div className="text-xs text-muted-foreground">Painéis de cargos</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/setup`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Wand2 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Setup Wizard</div>
                <div className="text-xs text-muted-foreground">Configuração guiada</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/automod`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">AutoMod</div>
                <div className="text-xs text-muted-foreground">Moderação automática</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/autorole`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <UserPlus className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Autorole</div>
                <div className="text-xs text-muted-foreground">Cargos para novos membros</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/welcome`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Boas-vindas</div>
                <div className="text-xs text-muted-foreground">Mensagens e canais automáticos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/settings`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Settings className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Configurações</div>
                <div className="text-xs text-muted-foreground">Preferências do servidor</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/modlogs`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Logs</div>
                <div className="text-xs text-muted-foreground">Histórico de ações</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/members`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Membros</div>
                <div className="text-xs text-muted-foreground">Gerenciar usuários</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/moderation`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Moderação</div>
                <div className="text-xs text-muted-foreground">Configurações de punição e automação</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/giveaways`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Sorteios</div>
                <div className="text-xs text-muted-foreground">Criar e gerenciar</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/overview`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Visão geral</div>
                <div className="text-xs text-muted-foreground">Estatísticas e resumo</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/xp`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">XP</div>
                <div className="text-xs text-muted-foreground">Níveis e recompensas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/tickets`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Tickets</div>
                <div className="text-xs text-muted-foreground">Suporte e painel</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer transition-colors hover:border-accent/40"
          onClick={() => navigate(`/guild/${guildId}/suggestions`)}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Lightbulb className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Sugestões</div>
                <div className="text-xs text-muted-foreground">Canal e lista</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
