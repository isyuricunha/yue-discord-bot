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
    border: 'border-cursor-success/40',
    bg: 'bg-cursor-bg-widget',
    iconBg: 'bg-cursor-success/15',
    iconColor: 'text-cursor-success',
    dot: 'bg-cursor-success',
    Icon: CheckCircle,
  },
  error: {
    border: 'border-cursor-error/40',
    bg: 'bg-cursor-bg-widget',
    iconBg: 'bg-cursor-error/15',
    iconColor: 'text-cursor-error',
    dot: 'bg-cursor-error',
    Icon: AlertCircle,
  },
  default: {
    border: 'border-accent/30',
    bg: 'bg-cursor-bg-widget',
    iconBg: 'bg-cursor-accent-soft',
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
              'pointer-events-auto overflow-hidden rounded-lg border shadow-cursorMd',
              'animate-in slide-in-from-right-full duration-[160ms] ease-cursor',
              'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full',
              styles.border,
              styles.bg
            )}
            style={{ animationDelay: `${index * 50}ms` }}
            role="status"
          >
            <div className="flex items-start gap-3 p-4">
              <div className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-md',
                styles.iconBg
              )}>
                <IconComponent className={cn('h-5 w-5', styles.iconColor)} />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                {t.title && (
                  <div className={cn(
                    'text-sm font-semibold',
                    t.variant === 'success' && 'text-cursor-success',
                    t.variant === 'error' && 'text-cursor-error',
                    t.variant === 'default' && 'text-white'
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
                  'hover:bg-cursor-bg-hover hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-accent'
                )}
                aria-label="Fechar notificação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-0.5 w-full bg-cursor-bg-surface-hover">
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
