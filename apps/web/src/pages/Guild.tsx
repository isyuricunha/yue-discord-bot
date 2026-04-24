import { useParams } from 'react-router-dom'
import { Card, CardContent } from '../components/ui'
import { Seo } from '../components/seo/seo'
import { useGuildSummary } from './guild/hooks'
import { useGuildModules } from './guild/hooks'
import { GuildCard } from './guild/components/GuildCard'
import { GuildModuleCard } from './guild/components/GuildModuleCard'

export default function GuildPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const guildIdValid = guildId ?? ''

  // Custom hooks para dados da guild
  const { guild, isLoading, isError, error } = useGuildSummary(guildIdValid)
  const { groupedModules, categoryLabels, categoryOrder } = useGuildModules(guildIdValid)

  return (
    <>
      <Seo />
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <Card>
          <CardContent className="p-5">
            <GuildCard guild={guild} isLoading={isLoading} />
          </CardContent>
        </Card>

        {!isLoading && isError && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-base font-semibold text-destructive">Erro ao carregar servidor</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {error?.message || 'Não foi possível carregar os dados do servidor'}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Verifique se você tem acesso a esta guild e se o bot está online
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !guild && !isError && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-base font-semibold">Servidor não encontrado</div>
              <div className="mt-2 text-sm text-muted-foreground">Verifique se você tem acesso a esta guild.</div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError &&
          categoryOrder.map((category) => {
            const items = groupedModules[category]
            if (!items || items.length === 0) return null

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {categoryLabels[category]}
                  </h2>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <GuildModuleCard key={item.to} item={item} />
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    </>
  )
}
