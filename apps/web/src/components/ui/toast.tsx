/**
 * Componente Toast para notificações
 *
 * @param {Object} props - Props do componente
 * @returns {JSX.Element} Toast renderizado
 */
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

import { cn } from '../../lib/cn'
import { useToastStore } from '../../store/toast'

const toast_styles = {
  success: {
    border: 'border-success/30',
    bg: 'bg-popover',
    iconBg: 'bg-success/20',
    iconColor: 'text-success',
    dot: 'bg-success',
    Icon: CheckCircle,
  },
  error: {
    border: 'border-danger/30',
    bg: 'bg-popover',
    iconBg: 'bg-danger/20',
    iconColor: 'text-danger',
    dot: 'bg-danger',
    Icon: AlertCircle,
  },
  default: {
    border: 'border-info/30',
    bg: 'bg-popover',
    iconBg: 'bg-info/20',
    iconColor: 'text-info',
    dot: 'bg-info',
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
              'pointer-events-auto overflow-hidden rounded-2xl border shadow-floating animate-slide-in-right',
              styles.border,
              styles.bg
            )}
            style={{ animationDelay: `${index * 50}ms` }}
            role="status"
          >
            <div className="flex items-start gap-3 p-4">
              <div className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                styles.iconBg
              )}>
                <IconComponent className={cn('h-5 w-5', styles.iconColor)} />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                {t.title && (
                  <div className={cn(
                    'text-sm font-semibold',
                    t.variant === 'success' && 'text-success',
                    t.variant === 'error' && 'text-danger',
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
                  'hover:bg-surface-hover hover:text-foreground transition-colors'
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
