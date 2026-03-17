import * as React from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/cn'
import { Button } from './ui/button'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false)

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
    } finally {
      setIsConfirming(false)
      onClose()
    }
  }

  const variantStyles = {
    danger: {
      icon: 'bg-red-500/20 text-red-500',
      button: 'bg-red-500 hover:bg-red-400 text-white',
    },
    warning: {
      icon: 'bg-yellow-500/20 text-yellow-500',
      button: 'bg-yellow-500 hover:bg-yellow-400 text-black',
    },
    info: {
      icon: 'bg-accent/20 text-accent',
      button: 'bg-accent hover:bg-accent/90 text-black',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'grid h-12 w-12 shrink-0 place-items-center rounded-xl',
                styles.icon
              )}
            >
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="flex-1">
              <h3
                id="confirm-title"
                className="text-lg font-semibold"
              >
                {title}
              </h3>
              <p
                id="confirm-description"
                className="mt-2 text-sm text-muted-foreground"
              >
                {description}
              </p>
            </div>

            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface/70 hover:text-foreground transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              {cancelText}
            </Button>
            <Button
              onClick={handleConfirm}
              isLoading={isConfirming}
              className={styles.button}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook for easy use
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    isOpen: boolean
    config: Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'> & {
      onConfirm: () => void | Promise<void>
    }
  }>({
    isOpen: false,
    config: {
      title: '',
      description: '',
      onConfirm: () => {},
    },
  })

  const open = React.useCallback(
    (config: Omit<ConfirmDialogProps, 'isOpen' | 'onClose'> & { onConfirm: () => void | Promise<void> }) => {
      setState({ isOpen: true, config })
    },
    []
  )

  const close = React.useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const dialog = (
    <ConfirmDialog
      isOpen={state.isOpen}
      onClose={close}
      onConfirm={state.config.onConfirm}
      title={state.config.title}
      description={state.config.description}
      confirmText={state.config.confirmText}
      cancelText={state.config.cancelText}
      variant={state.config.variant}
    />
  )

  return { open, close, dialog }
}
