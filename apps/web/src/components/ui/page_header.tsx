import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

interface PageHeaderProps {
    icon: LucideIcon
    title: string
    description: string
    children?: React.ReactNode
    className?: string
}

export function PageHeader({ icon: Icon, title, description, children, className }: PageHeaderProps) {
    return (
        <div className={cn('flex items-center justify-between gap-4', className)}>
            <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                    <Icon className="h-5 w-5" />
                </span>
                <div>
                    <div className="text-xl font-semibold tracking-tight">{title}</div>
                    <div className="text-sm text-muted-foreground">{description}</div>
                </div>
            </div>
            {children}
        </div>
    )
}
