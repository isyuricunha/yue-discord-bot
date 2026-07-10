import { ArrowUp, Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '../../lib/cn'

const MAX_LENGTH = 4000
const WARN_THRESHOLD = 3600

type PanelAssistantComposerProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
  loading?: boolean
  className?: string
}

export const PanelAssistantComposer = React.forwardRef<HTMLTextAreaElement, PanelAssistantComposerProps>(function PanelAssistantComposer({
  value,
  onChange,
  onSend,
  disabled,
  loading = false,
  className,
}, forwardedRef) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = React.useState(false)

  React.useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, [])

  // Auto-resize textarea
  const handleInput = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  React.useLayoutEffect(() => {
    handleInput()
  }, [handleInput, value])

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
      handleInput()
    },
    [onChange, handleInput]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // IME composition should not submit
      if (e.nativeEvent.isComposing) return

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSend()
      }
    },
    [onSend]
  )

  const handleSendClick = React.useCallback(() => {
    onSend()
  }, [onSend])

  const remaining = MAX_LENGTH - value.length
  const showCounter = value.length >= WARN_THRESHOLD

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-border/60 bg-surface-raised transition-colors duration-150',
        focused && 'border-accent/40 shadow-[0_0_0_2px_rgba(201,130,24,0.12)]',
        className
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Pergunte algo sobre este servidor..."
        disabled={disabled}
        maxLength={MAX_LENGTH}
        rows={1}
        className={cn(
          'w-full resize-none bg-transparent px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none disabled:opacity-50',
          'leading-relaxed'
        )}
        aria-label="Campo de mensagem"
      />

      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        {showCounter && (
          <span
            className={cn(
              'text-[11px] tabular-nums transition-colors',
              remaining <= 200 ? 'text-danger' : remaining <= 800 ? 'text-warning' : 'text-muted-foreground/60'
            )}
          >
            {remaining}
          </span>
        )}

        <button
          type="button"
          onClick={handleSendClick}
          disabled={disabled}
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors',
            'bg-accent text-accent-foreground hover:bg-accent-hover',
            'disabled:cursor-not-allowed disabled:opacity-40',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35'
          )}
          aria-label="Enviar mensagem"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
})
