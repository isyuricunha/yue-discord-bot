import { cn } from '../../lib/cn'
import { Switch } from './switch'

interface ConfigCardProps {
    title: string
    description?: string
    icon?: React.ReactNode
    enabled: boolean
    onToggle: (checked: boolean) => void
    disabled?: boolean
    children?: React.ReactNode
    className?: string
    label?: string
}

export function ConfigCard({
    title,
    description,
    icon,
    enabled,
    onToggle,
    disabled,
    children,
    className,
    label,
}: ConfigCardProps) {
    return (
        <div className={cn('rounded-2xl border border-border/80 bg-surface/40 p-6', className)}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {icon && <span className="text-accent">{icon}</span>}
                    <div>
                        <div className="text-sm font-semibold">{title}</div>
                        {description && <div className="text-xs text-muted-foreground">{description}</div>}
                    </div>
                </div>
                <Switch checked={enabled} onCheckedChange={onToggle} disabled={disabled} label={label} />
            </div>
            {enabled && children && <div className="mt-4 space-y-4">{children}</div>}
        </div>
    )
}
