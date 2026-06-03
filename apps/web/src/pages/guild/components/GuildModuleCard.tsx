import { useNavigate } from 'react-router-dom'
import { cn } from '../../../lib/cn'
import { Card, CardContent } from '../../../components/ui'
import type { ModuleCard } from '../types'

interface GuildModuleCardProps {
    item: ModuleCard
}

export function GuildModuleCard({ item }: GuildModuleCardProps) {
    const navigate = useNavigate()

    return (
        <Card
            className={cn(
                'group cursor-pointer overflow-hidden transition-all duration-200',
                'hover:border-accent/40 hover:shadow-sm',
                'focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/30'
            )}
            onClick={() => navigate(item.to)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(item.to)
                }
            }}
            aria-label={`Acessar ${item.label} - ${item.description}`}
        >
            <CardContent className="p-5">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent transition-colors group-hover:bg-accent/10">
                        {item.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold group-hover:text-accent transition-colors">
                            {item.label}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
