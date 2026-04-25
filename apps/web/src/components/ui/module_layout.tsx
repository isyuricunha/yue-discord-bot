import { cn } from '../../lib/cn'

interface ModuleLayoutProps {
    children: React.ReactNode
    className?: string
    maxWidth?: 'md' | 'lg' | 'xl' | '4xl' | '7xl'
}

const max_width_classes: Record<string, string> = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '4xl': 'max-w-4xl',
    '7xl': 'max-w-7xl',
}

export function ModuleLayout({ children, className, maxWidth = '7xl' }: ModuleLayoutProps) {
    return (
        <div className={cn('mx-auto w-full space-y-6', max_width_classes[maxWidth] ?? max_width_classes['7xl'], className)}>
            {children}
        </div>
    )
}
