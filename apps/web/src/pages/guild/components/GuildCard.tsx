/**
 * Componente GuildCard para exibir informações da guild
 *
 * @param {Object} props - Props do componente
 * @param {Guild} props.guild - Dados da guild
 * @param {boolean} props.isLoading - Estado de carregamento
 * @returns {JSX.Element} Card da guild com imagem, nome e descrição
 */

import { Skeleton } from '../../../components/ui'
import type { Guild } from '../types'

export function GuildCard({ guild, isLoading }: { guild: Guild | null; isLoading: boolean }) {
    return (
        <div className="flex items-center gap-4">
            {isLoading ? (
                <Skeleton className="h-14 w-14 rounded-2xl" />
            ) : guild?.icon ? (
                <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                    alt={guild.name}
                    className="h-14 w-14 rounded-2xl"
                    loading="lazy"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.onerror = null
                        target.src = '/placeholder-guild.png'
                    }}
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
        </div>
    )
}