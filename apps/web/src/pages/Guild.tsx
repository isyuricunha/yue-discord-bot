import { useParams } from 'react-router-dom'
import { Seo } from '../components/seo/seo'
import { useGuildSummary, useGuildModules } from './guild/hooks'
import { GuildCard } from './guild/components/GuildCard'
import { GuildModuleCard } from './guild/components/GuildModuleCard'
import { ErrorState, EmptyState } from '../components/ui'
import { SkeletonPageHeader } from '../components/ui/skeleton_presets'

export default function GuildPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const guildIdValid = guildId ?? ''

  const { guild, isLoading, isError, error } = useGuildSummary(guildIdValid)
  const { groupedModules, categoryLabels, categoryOrder } = useGuildModules(guildIdValid)

  if (isLoading) {
    return (
      <>
        <Seo />
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <SkeletonPageHeader />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl border border-border/60 bg-surface/30" />
            ))}
          </div>
        </div>
      </>
    )
  }

  if (isError) {
    return (
      <>
        <Seo />
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <ErrorState
            title="Erro ao carregar servidor"
            description={error?.message || 'Não foi possível carregar os dados do servidor. Verifique se você tem acesso a esta guild e se o bot está online.'}
            actionLabel="Tentar novamente"
            onAction={() => window.location.reload()}
          />
        </div>
      </>
    )
  }

  if (!guild) {
    return (
      <>
        <Seo />
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <EmptyState
            title="Servidor não encontrado"
            description="Verifique se você tem acesso a esta guild."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Seo />
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <GuildCard guild={guild} />

        {categoryOrder.map((category) => {
          const items = groupedModules[category]
          if (!items || items.length === 0) return null

          return (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {categoryLabels[category]}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
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
