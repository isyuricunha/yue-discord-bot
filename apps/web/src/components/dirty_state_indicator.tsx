import { Save, RotateCcw, AlertCircle } from 'lucide-react'
import { cn } from '../lib/cn'
import { Button } from './ui/button'

interface DirtyStateIndicatorProps {
  isDirty: boolean
  isSaving?: boolean
  onSave?: () => void
  onReset?: () => void
  saveLabel?: string
  resetLabel?: string
  className?: string
}

export function DirtyStateIndicator({
  isDirty,
  isSaving = false,
  onSave,
  onReset,
  saveLabel = 'Salvar',
  resetLabel = 'Descartar',
  className,
}: DirtyStateIndicatorProps) {
  if (!isDirty && !isSaving) return null

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md',
        'animate-in slide-in-from-bottom-2 fade-in duration-200',
        isSaving
          ? 'border-accent/30 bg-accent/10'
          : 'border-yellow-500/30 bg-yellow-500/10',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {isSaving ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <span className="text-sm font-medium text-accent">Salvando...</span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-400">
            Alterações não salvas
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {!isSaving && onReset && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-8 border-yellow-500/30 hover:bg-yellow-500/20"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {resetLabel}
          </Button>
        )}
        {!isSaving && onSave && (
          <Button
            size="sm"
            onClick={onSave}
            className="h-8 bg-yellow-500 text-black hover:bg-yellow-400"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

// Fixed position version that floats at bottom
export function DirtyStateFloating(props: DirtyStateIndicatorProps) {
  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4">
      <DirtyStateIndicator {...props} className={cn('w-full', props.className)} />
    </div>
  )
}

// Inline version for forms
export function DirtyStateInline({
  isDirty,
  isSaving = false,
}: {
  isDirty: boolean
  isSaving?: boolean
}) {
  if (!isDirty && !isSaving) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        isSaving ? 'text-accent' : 'text-yellow-500'
      )}
    >
      {isSaving ? (
        <>
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Salvando...
        </>
      ) : (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
          Modificado
        </>
      )}
    </span>
  )
}
