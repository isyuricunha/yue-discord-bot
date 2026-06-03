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
                <span className="grid h-9 w-9 place-items-center rounded-md border border-border/80 bg-surface text-accent">
                    <Icon className="h-5 w-5" />
                </span>
                <div>
                    <div className="text-lg font-semibold text-white">{title}</div>
                    <div className="text-sm text-muted-foreground">{description}</div>
                </div>
            </div>
            {children}
        </div>
    )
}
