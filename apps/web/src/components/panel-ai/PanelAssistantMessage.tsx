import { Copy, Sparkles } from 'lucide-react'
import * as React from 'react'

import { cn } from '../../lib/cn'
import { toast_error, toast_success } from '../../store/toast'
import { Button } from '../ui/button'
import { PanelAssistantMarkdown } from './PanelAssistantMarkdown'

type PanelAssistantMessageProps = {
  role: 'user' | 'assistant' | 'thinking' | 'error'
  content: string
  isError?: boolean
  onRetry?: () => void
  retryDisabled?: boolean
  className?: string
}

export function PanelAssistantMessage({ role, content, isError, onRetry, retryDisabled = false, className }: PanelAssistantMessageProps) {
  const isUser = role === 'user'
  const isThinking = role === 'thinking'
  const isErrorMsg = isError || role === 'error'

  // Copy to clipboard
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast_success('Resposta copiada.', 'Ella')
    } catch {
      toast_error('Não foi possível copiar. Tente selecionar o texto manualmente.', 'Ella')
    }
  }, [content])

  if (isThinking) {
    return (
      <div className={cn('flex items-start gap-3 px-1', className)} role="status" aria-live="polite">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Ella está pensando</span>
          <span className="inline-flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 motion-reduce:animate-none" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 motion-reduce:animate-none" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 motion-reduce:animate-none" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      </div>
    )
  }

  if (isErrorMsg) {
    return (
      <div className={cn('flex items-start gap-3 px-1', className)}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {content}
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={retryDisabled} className="mt-2 h-7 px-2 text-xs">
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className={cn('flex justify-end px-1', className)}>
        <div className="max-w-[80%] min-w-[120px] rounded-2xl bg-accent/15 px-4 py-2.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className={cn('group flex items-start gap-3 px-1', className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <PanelAssistantMarkdown>{content}</PanelAssistantMarkdown>
        <div className="mt-1 flex items-center gap-2 opacity-100 transition-opacity duration-150 sm:opacity-60 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Copiar resposta"
          >
            <Copy className="h-3 w-3" />
            Copiar
          </Button>
        </div>
      </div>
    </div>
  )
}
