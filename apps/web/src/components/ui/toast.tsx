import { X } from 'lucide-react'

import { cn } from '../../lib/cn'
import { useToastStore, type toast_item } from '../../store/toast'

function tone(variant: toast_item['variant']) {
  if (variant === 'success') return 'border-accent/35 bg-surface/70'
  if (variant === 'error') return 'border-accent/35 bg-surface/70'
  return 'border-border/80 bg-surface/70'
}

function dot(variant: toast_item['variant']) {
  if (variant === 'success') return 'bg-accent'
  if (variant === 'error') return 'bg-accent'
  return 'bg-muted-foreground'
}

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-3"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-md',
            'animate-[fadeIn_220ms_ease-out]',
            tone(t.variant)
          )}
          role="status"
        >
          <div className="flex items-start gap-3 p-4">
            <div className={cn('mt-1 h-2 w-2 shrink-0 rounded-full shadow-[0_0_16px_rgba(255,106,0,0.35)]', dot(t.variant))} />

            <div className="min-w-0 flex-1">
              {t.title && <div className="text-sm font-semibold">{t.title}</div>}
              <div className="mt-1 text-sm text-muted-foreground">{t.message}</div>
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-xl border border-border/70 bg-surface/40 text-muted-foreground',
                'hover:bg-surface/70 hover:text-foreground transition-colors'
              )}
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
