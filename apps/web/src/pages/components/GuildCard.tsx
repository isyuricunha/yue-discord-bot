import { useNavigate } from 'react-router-dom'
import { Shield, Trophy, Settings } from 'lucide-react'
import { Card, CardContent } from '../../components/ui'

interface Guild {
    id: string
    name: string
    icon: string | null
    permissions?: string
    owner?: boolean
    features?: string[]
}

interface GuildCardProps {
    guild: Guild
    className?: string
}

export function GuildCard({ guild, className = '' }: GuildCardProps) {
    const navigate = useNavigate()

    // Fallback for guild icon
    const getGuildIconUrl = (id: string, icon: string | null): string => {
        if (icon) {
            return `https://cdn.discordapp.com/icons/${id}/${icon}.png`
        }
        return ''
    }

    const guildIconUrl = getGuildIconUrl(guild.id, guild.icon)
    const hasIcon = guildIconUrl && guild.icon

    return (
        <Card
            key={guild.id}
            className={`group cursor-pointer transition-colors hover:border-accent/40 ${className}`}
            onClick={() => navigate(`/guild/${guild.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/guild/${guild.id}`)}
            aria-label={`Abrir configurações do servidor ${guild.name}`}
        >
            <CardContent className="p-5">
                <div className="flex items-center gap-4">
                    {hasIcon ? (
                        <img
                            src={guildIconUrl}
                            alt={guild.name}
                            className="h-14 w-14 rounded-2xl"
                            loading="lazy"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.onerror = null
                                target.style.display = 'none'
                            }}
                        />
                    ) : (
                        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border/80 bg-surface/70 text-lg font-semibold">
                            <span className="text-accent">{guild.name.charAt(0)}</span>
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold tracking-tight group-hover:text-foreground transition-colors">
                            {guild.name}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">Clique para abrir</div>
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <div className="flex-1 rounded-xl border border-border/70 bg-surface/50 p-2.5 text-center transition-colors group-hover:bg-surface/70 group-hover:border-accent/20">
                        <Shield className="mx-auto h-4 w-4 text-accent" aria-label="AutoMod" />
                        <div className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">AutoMod</div>
                    </div>
                    <div className="flex-1 rounded-xl border border-border/70 bg-surface/50 p-2.5 text-center transition-colors group-hover:bg-surface/70 group-hover:border-accent/20">
                        <Trophy className="mx-auto h-4 w-4 text-accent" aria-label="Sorteios" />
                        <div className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">Sorteios</div>
                    </div>
                    <div className="flex-1 rounded-xl border border-border/70 bg-surface/50 p-2.5 text-center transition-colors group-hover:bg-surface/70 group-hover:border-accent/20">
                        <Settings className="mx-auto h-4 w-4 text-accent" aria-label="Configuração" />
                        <div className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">Config</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}