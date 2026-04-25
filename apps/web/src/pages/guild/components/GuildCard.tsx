import { Crown, Hash } from 'lucide-react'
import { Skeleton } from '../../../components/ui'
import type { Guild } from '../types'

interface GuildCardProps {
    guild: Guild
    isLoading?: boolean
}

export function GuildCard({ guild, isLoading = false }: GuildCardProps) {
    const guildIconUrl = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
        : null

    return (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {isLoading ? (
                <Skeleton className="h-20 w-20 rounded-3xl" />
            ) : guildIconUrl ? (
                <img
                    src={guildIconUrl}
                    alt={guild.name}
                    className="h-20 w-20 rounded-3xl border border-border/80 bg-surface/60 object-cover"
                    loading="lazy"
                    onError={(e) => {
                        const target = e.currentTarget
                        target.onerror = null
                        target.style.display = 'none'
                    }}
                />
            ) : null}

            {!guildIconUrl && !isLoading && (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl border border-border/80 bg-surface/70 text-2xl font-bold">
                    <span className="text-accent">{guild.name.charAt(0)}</span>
                </div>
            )}

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <Skeleton className="h-7 w-56" />
                    ) : (
                        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                            {guild.name}
                        </h1>
                    )}
                    {!isLoading && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                            <Crown className="h-3 w-3" aria-hidden="true" />
                            Dono
                        </span>
                    )}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    {isLoading ? (
                        <Skeleton className="h-4 w-40" />
                    ) : (
                        <>
                            <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="font-mono text-xs">{guild.id}</span>
                        </>
                    )}
                </div>
                {!isLoading && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        Painel de gerenciamento do servidor
                    </p>
                )}
            </div>
        </div>
    )
}
