import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

// Semantic colors from YuTheme: each module gets its own identity without
// becoming a rainbow. Gold is the default for general-purpose pages.
type semantic_color = 'gold' | 'cyan' | 'green' | 'red' | 'purple' | 'blue'

const semantic_icon_classes: Record<semantic_color, string> = {
  gold: 'text-accent',
  cyan: 'text-info',
  green: 'text-success',
  red: 'text-danger',
  purple: 'text-agent',
  blue: 'text-info',
}

interface PageHeaderProps {
    icon: LucideIcon
    title: string
    description: string
    color?: semantic_color
    children?: React.ReactNode
    className?: string
}

export function PageHeader({ icon: Icon, title, description, color = 'gold', children, className }: PageHeaderProps) {
    return (
        <div className={cn('flex items-center justify-between gap-4', className)}>
            <div className="flex items-center gap-3">
                <span className={cn(
                    'grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface-raised shadow-innerBorder',
                    semantic_icon_classes[color]
                )}>
                    <Icon className="h-5 w-5" />
                </span>
                <div>
                    <div className="text-xl font-semibold tracking-tight text-foreground">{title}</div>
                    <div className="text-sm text-muted-foreground">{description}</div>
                </div>
            </div>
            {children}
        </div>
    )
}
