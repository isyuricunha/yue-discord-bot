import { Copy, ExternalLink, Highlighter, ListTree, ShieldCheck, Sparkles } from 'lucide-react'
import * as React from 'react'
import type { panel_ai_action, panel_ai_sensitive_request } from '@yuebot/shared'

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
  actions?: panel_ai_action[]
  sensitiveRequest?: panel_ai_sensitive_request | null
  onAction?: (action: panel_ai_action) => void
  onSensitiveConfirm?: (request: panel_ai_sensitive_request) => void
  onSensitiveDecline?: (request: panel_ai_sensitive_request) => void
  sensitiveDisabled?: boolean
  className?: string
}

function ActionIcon({ action }: { action: panel_ai_action }) {
  if (action.type === 'navigate') return <ExternalLink className="h-3.5 w-3.5" />
  if (action.type === 'open_section') return <ListTree className="h-3.5 w-3.5" />
  return <Highlighter className="h-3.5 w-3.5" />
}

export function PanelAssistantMessage({
  role,
  content,
  isError,
  onRetry,
  retryDisabled = false,
  actions = [],
  sensitiveRequest,
  onAction,
  onSensitiveConfirm,
  onSensitiveDecline,
  sensitiveDisabled = false,
  className,
}: PanelAssistantMessageProps) {
  const isUser = role === 'user'
  const isThinking = role === 'thinking'
  const isErrorMsg = isError || role === 'error'

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

  return (
    <div className={cn('group flex items-start gap-3 px-1', className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <PanelAssistantMarkdown>{content}</PanelAssistantMarkdown>

        {actions.length > 0 && onAction && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Ações sugeridas pela Ella">
            {actions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => onAction(action)}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <ActionIcon action={action} />
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {sensitiveRequest && onSensitiveConfirm && onSensitiveDecline && (
          <div className="mt-3 rounded-xl border border-border/70 bg-surface-raised p-3" role="group" aria-label="Solicitação de contexto sensível">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{sensitiveRequest.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {sensitiveRequest.description}
                </p>
                <p className="mt-2 text-xs font-medium text-foreground">
                  Nada abaixo foi enviado ainda. Se você permitir, este bloco exato será usado uma única vez neste turno.
                </p>
              </div>
            </div>

            <details className="mt-3 rounded-lg border border-border/60 bg-surface/40">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">
                Ver exatamente o que será enviado
              </summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-border/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {sensitiveRequest.preview}
              </pre>
            </details>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => onSensitiveConfirm(sensitiveRequest)}
                disabled={sensitiveDisabled}
                className="h-8 px-3 text-xs"
              >
                Permitir uma vez
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSensitiveDecline(sensitiveRequest)}
                disabled={sensitiveDisabled}
                className="h-8 px-3 text-xs"
              >
                Não enviar
              </Button>
            </div>
          </div>
        )}

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
