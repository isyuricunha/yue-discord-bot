import { ReactNode } from 'react'

interface StatCardProps {
    icon: ReactNode
    value: string | number
    label: string
    isLoading?: boolean
    className?: string
}

export function StatCard({ icon, value, label, isLoading = false, className = '' }: StatCardProps) {
    return (
        <div className={`rounded-xl border border-border/60 bg-surface/40 backdrop-blur-xl p-4 text-center transition-all duration-300 hover:border-accent/30 hover:bg-surface/60 ${className}`}>
            {icon}
            <div className="text-2xl font-bold text-foreground">
                {isLoading ? <span className="animate-pulse">---</span> : value}
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    )
}