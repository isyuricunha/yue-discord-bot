import { useNavigate } from 'react-router-dom'
import { Shield, Trophy, Settings, Crown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Card, CardContent } from '../../components/ui'
import type { Guild } from '../../hooks/useGuilds'

interface GuildCardProps {
    guild: Guild
    className?: string
}

export function GuildCard({ guild, className = '' }: GuildCardProps) {
    const navigate = useNavigate()

    const guildIconUrl = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
        : null

    const handleClick = () => navigate(`/guild/${guild.id}`)

    return (
        <Card
            className={cn(
                'group cursor-pointer overflow-hidden transition-all duration-200 hover:border-accent/40 focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/30',
                className
            )}
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleClick()
                }
            }}
            aria-label={`Abrir configurações do servidor ${guild.name}`}
        >
            <CardContent className="p-5">
                <div className="flex items-center gap-4">
                    {guildIconUrl ? (
                        <img
                            src={guildIconUrl}
                            alt={guild.name}
                            className="h-14 w-14 rounded-2xl bg-surface/60 object-cover"
                            loading="lazy"
                            onError={(e) => {
                                const target = e.currentTarget
                                target.onerror = null
                                target.src = ''
                                target.style.display = 'none'
                                // O fallback é renderizado condicionalmente abaixo
                            }}
                        />
                    ) : null}

                    {/* Fallback visível quando não há ícone ou imagem falhou */}
                    {!guildIconUrl && (
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border/80 bg-surface/70 text-lg font-semibold">
                            <span className="text-accent">{guild.name.charAt(0)}</span>
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <div className="truncate text-base font-semibold tracking-tight group-hover:text-foreground transition-colors">
                                {guild.name}
                            </div>
                            {guild.owner && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                                    <Crown className="h-2.5 w-2.5" aria-hidden="true" />
                                    Dono
                                </span>
                            )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">Clique para abrir</div>
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <div
                        role="button"
                        tabIndex={0}
                        className="flex-1 rounded-xl border border-border/70 bg-surface/50 p-2.5 text-center transition-colors hover:border-accent/30 hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        aria-label="Abrir AutoMod"
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/guild/${guild.id}/automod`)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                e.stopPropagation()
                                navigate(`/guild/${guild.id}/automod`)
                            }
                        }}
                    >
                        <Shield className="mx-auto h-4 w-4 text-accent" aria-hidden="true" />
                        <div className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">AutoMod</div>
                    </div>
                    <div
                        role="button"
                        tabIndex={0}
                        className="flex-1 rounded-xl border border-border/70 bg-surface/50 p-2.5 text-center transition-colors hover:border-accent/30 hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        aria-label="Abrir Sorteios"
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/guild/${guild.id}/giveaways`)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                e.stopPropagation()
                                navigate(`/guild/${guild.id}/giveaways`)
                            }
                        }}
                    >
                        <Trophy className="mx-auto h-4 w-4 text-accent" aria-hidden="true" />
                        <div className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">Sorteios</div>
                    </div>
                    <div
                        role="button"
                        tabIndex={0}
                        className="flex-1 rounded-xl border border-border/70 bg-surface/50 p-2.5 text-center transition-colors hover:border-accent/30 hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        aria-label="Abrir Configurações"
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/guild/${guild.id}/settings`)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                e.stopPropagation()
                                navigate(`/guild/${guild.id}/settings`)
                            }
                        }}
                    >
                        <Settings className="mx-auto h-4 w-4 text-accent" aria-hidden="true" />
                        <div className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">Config</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
