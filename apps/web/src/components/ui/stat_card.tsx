/**
 * Card de estatísticas reutilizável com ícone, valor e label.
 */
import * as React from 'react'

import { cn } from '../../lib/cn'
import { Card } from './card'

type stat_card_props = {
    icon: React.ReactNode
    value: React.ReactNode
    label: string
    isLoading?: boolean
    className?: string
}

export function StatCard({
    icon,
    value,
    label,
    isLoading = false,
    className,
}: stat_card_props) {
    return (
        <Card
            className={cn(
                'p-4 text-center transition-colors duration-150 hover:border-accent/30',
                className
            )}
        >
            <div className="flex flex-col items-center gap-2">
                <div className="text-accent/80" aria-hidden="true">
                    {icon}
                </div>
                <div className="text-2xl font-bold text-foreground">
                    {isLoading ? (
                        <span className="cursor-text-shimmer font-mono">---</span>
                    ) : (
                        value
                    )}
                </div>
                <div className="text-xs text-muted-foreground">{label}</div>
            </div>
        </Card>
    )
}
