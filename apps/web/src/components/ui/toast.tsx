import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

import { cn } from '../../lib/cn'
import { useToastStore } from '../../store/toast'

const toast_styles = {
  success: {
    border: 'border-green-500/30',
    bg: 'bg-green-500/10',
    iconBg: 'bg-green-500/20',
    iconColor: 'text-green-500',
    dot: 'bg-green-500',
    Icon: CheckCircle,
  },
  error: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-500',
    dot: 'bg-red-500',
    Icon: AlertCircle,
  },
  default: {
    border: 'border-accent/30',
    bg: 'bg-surface/70',
    iconBg: 'bg-accent/20',
    iconColor: 'text-accent',
    dot: 'bg-accent',
    Icon: Info,
  },
}

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[400px] max-w-[calc(100vw-40px)] flex-col gap-3"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.map((t, index) => {
        const styles = toast_styles[t.variant]
        const IconComponent = styles.Icon

        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md',
              'animate-in slide-in-from-right-full duration-300 ease-out',
              'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full',
              styles.border,
              styles.bg
            )}
            style={{ animationDelay: `${index * 50}ms` }}
            role="status"
          >
            <div className="flex items-start gap-3 p-4">
              <div className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                styles.iconBg
              )}>
                <IconComponent className={cn('h-5 w-5', styles.iconColor)} />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                {t.title && (
                  <div className={cn(
                    'text-sm font-semibold',
                    t.variant === 'success' && 'text-green-400',
                    t.variant === 'error' && 'text-red-400',
                    t.variant === 'default' && 'text-foreground'
                  )}>
                    {t.title}
                  </div>
                )}
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {t.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-lg text-muted-foreground',
                  'hover:bg-white/5 hover:text-foreground transition-colors'
                )}
                aria-label="Fechar notificação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full bg-white/5">
              <div
                className={cn(
                  'h-full animate-progress',
                  styles.dot
                )}
                style={{
                  animationDuration: `${t.duration_ms}ms`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
