import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Card, CardContent, Skeleton, Button, Input } from '../components/ui'
import { useAuthStore } from '../store/auth'
import { GuildCard } from './components/GuildCard'
import { useGuilds, useDebounce } from '../hooks'
import type { Guild } from '../hooks/useGuilds'
import { Seo } from '../components/seo/seo'

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

  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(internalSearchQuery, 300)

  // Sync debounced search with hook search
  useEffect(() => {
    setSearchQuery(debouncedSearchQuery)
  }, [debouncedSearchQuery, setSearchQuery])

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
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-destructive mb-4 text-sm">{error?.message || 'Não foi possível carregar seus servidores'}</div>
              <div className="text-sm text-muted-foreground">
                Tente recarregar a página ou verifique sua conexão com a internet.
              </div>
              <Button
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

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
          <div className="flex w-full flex-col sm:w-auto sm:flex-row sm:items-center gap-3">
            {!isLoading && (guilds?.length ?? 0) > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar servidor..."
                  value={internalSearchQuery}
                  onChange={(e) => setInternalSearchQuery(e.target.value)}
                  className="w-full sm:w-[250px] pl-9"
                />
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
            {filteredGuilds?.map((guild: Guild) => (
              <GuildCard key={guild.id} guild={guild} />
            ))}
            {filteredGuilds?.length === 0 && internalSearchQuery && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                Nenhum servidor encontrado para "{internalSearchQuery}"
              </div>
            )}
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
    </>
  )
}
