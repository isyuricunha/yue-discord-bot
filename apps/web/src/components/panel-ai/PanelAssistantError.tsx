import { AlertTriangle } from 'lucide-react'

import { cn } from '../../lib/cn'
import { Button } from '../ui/button'

type PanelAssistantErrorProps = {
  message: string
  onRetry?: () => void
  className?: string
}

export function PanelAssistantError({ message, onRetry, className }: PanelAssistantErrorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="h-7 gap-1 px-2 text-xs">
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
