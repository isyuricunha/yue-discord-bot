import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Server, Users, X } from 'lucide-react'
import {
  Button,
  Input,
  EmptyState,
  ErrorState,
  StatCard,
} from '../components/ui'
import { SkeletonDashboard } from '../components/ui/skeleton_presets'
import { useAuthStore } from '../store/auth'
import { GuildCard } from './components/GuildCard'
import { useGuilds, useDebounce, useBotStats } from '../hooks'
import type { Guild } from '../hooks/useGuilds'
import { Seo } from '../components/seo/seo'
import { formatNumber } from '../lib/format_number'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const {
    guilds,
    filteredGuilds,
    isLoading,
    isError,
    error,
    setSearchQuery,
    inviteUrl,
  } = useGuilds()

  const { stats, loading: statsLoading } = useBotStats()
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(internalSearchQuery, 300)

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Bom dia'
    if (hour >= 12 && hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  useEffect(() => {
    setSearchQuery(debouncedSearchQuery)
  }, [debouncedSearchQuery, setSearchQuery])

  const clearSearch = () => {
    setInternalSearchQuery('')
    setSearchQuery('')
  }

  if (isError) {
    return (
      <>
        <Seo />
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-semibold tracking-tight">Seus servidores</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {user?.isOwner
                  ? 'Você está em modo owner - acesso total aos servidores onde o bot está instalado.'
                  : 'Selecione um servidor para gerenciar as configurações.'}
              </div>
            </div>
          </div>
          <ErrorState
            title="Erro ao carregar servidores"
            description={error?.message || 'Não foi possível carregar seus servidores. Tente recarregar a página ou verifique sua conexão com a internet.'}
            actionLabel="Tentar novamente"
            onAction={() => window.location.reload()}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Seo />
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header de boas-vindas */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              {greeting}, {user?.username ?? 'Administrador'}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {user?.isOwner
                ? 'Você está em modo owner - acesso total aos servidores onde o bot está instalado.'
                : 'Selecione um servidor para gerenciar as configurações.'}
            </div>
          </div>
          <div className="flex w-full flex-col sm:w-auto sm:flex-row sm:items-center gap-3">
            {!isLoading && (guilds?.length ?? 0) > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar servidor..."
                  value={internalSearchQuery}
                  onChange={(e) => setInternalSearchQuery(e.target.value)}
                  className="w-full sm:w-[250px] pl-9 pr-9"
                />
                {internalSearchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full sm:w-auto sm:px-3"
              onClick={() => inviteUrl ? window.open(inviteUrl, '_blank') : undefined}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Adicionar servidor</span>
            </Button>
          </div>
        </div>

        {/* Stats do bot */}
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          role="region"
          aria-label="Estatísticas do bot"
          aria-live="polite"
        >
          <StatCard
            icon={<Server className="h-5 w-5" />}
            value={stats ? formatNumber(stats.servers) : '---'}
            label="Servidores"
            isLoading={statsLoading}
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            value={stats ? formatNumber(stats.users) : '---'}
            label="Usuários"
            isLoading={statsLoading}
          />
        </div>

        {isLoading ? (
          <SkeletonDashboard />
        ) : (
          <>
            {filteredGuilds && filteredGuilds.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredGuilds.map((guild: Guild) => (
                  <GuildCard key={guild.id} guild={guild} />
                ))}
              </div>
            ) : null}

            {filteredGuilds?.length === 0 && internalSearchQuery && (
              <EmptyState
                title="Nenhum servidor encontrado"
                description={`Não encontramos resultados para "${internalSearchQuery}"`}
                icon={<Search className="h-5 w-5 text-muted-foreground" />}
                action={{ label: 'Limpar busca', onClick: clearSearch }}
              />
            )}

            {!isLoading && guilds?.length === 0 && (
              <EmptyState
                title="Nenhum servidor encontrado"
                description={
                  user?.isOwner
                    ? 'O bot ainda não sincronizou nenhum servidor no banco. Verifique se ele está online e conectado.'
                    : 'Convide o bot para seus servidores onde você é administrador.'
                }
                icon={<Plus className="h-5 w-5 text-muted-foreground" />}
                action={
                  !user?.isOwner && inviteUrl
                    ? {
                      label: 'Adicionar bot ao servidor',
                      onClick: () => window.open(inviteUrl, '_blank'),
                    }
                    : undefined
                }
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
