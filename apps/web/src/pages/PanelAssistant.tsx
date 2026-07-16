import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'

import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { PanelAssistantComposer } from '../components/panel-ai/PanelAssistantComposer'
import { PanelAssistantEmptyState } from '../components/panel-ai/PanelAssistantEmptyState'
import { PanelAssistantError } from '../components/panel-ai/PanelAssistantError'
import { PanelAssistantMessage } from '../components/panel-ai/PanelAssistantMessage'
import { usePanelAssistantContext } from '../components/panel-ai/PanelAssistantProvider'

const QUICK_PROMPTS = [
  'Quais recursos posso configurar aqui?',
  'Como funciona o Anti-Raide?',
  'Revise as configurações deste servidor',
  'Como configurar as boas-vindas?',
]

export default function PanelAssistantPage() {
  const {
    activeGuildId,
    messages,
    operation,
    historyLoading,
    historyError,
    draft,
    setDraft,
    reloadHistory,
    send,
    retry,
    clearConversation,
    scrollVersion,
    focusVersion,
  } = usePanelAssistantContext()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const clearTriggerRef = useRef<HTMLButtonElement>(null)
  const cancelClearRef = useRef<HTMLButtonElement>(null)
  const clearDialogRef = useRef<HTMLDivElement>(null)
  const lastScrollVersionRef = useRef(scrollVersion)
  const lastFocusVersionRef = useRef(focusVersion)
  const dialogTitleId = useId()
  const dialogDescriptionId = useId()
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  useLayoutEffect(() => {
    if (focusVersion === lastFocusVersionRef.current || operation !== 'idle') return
    lastFocusVersionRef.current = focusVersion
    composerRef.current?.focus()
  }, [focusVersion, operation])

  useEffect(() => {
    if (scrollVersion === lastScrollVersionRef.current) return
    lastScrollVersionRef.current = scrollVersion
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    conversationEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' })
  }, [scrollVersion])

  const handleClear = useCallback(async () => {
    if (await clearConversation()) setShowConfirmClear(false)
  }, [clearConversation])

  const closeClearDialog = useCallback(() => {
    setShowConfirmClear(false)
    clearTriggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!showConfirmClear) return
    cancelClearRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && operation !== 'clearing') {
        event.preventDefault()
        closeClearDialog()
        return
      }
      if (event.key === 'Tab') {
        const controls = clearDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        if (!controls?.length) return
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeClearDialog, operation, showConfirmClear])

  const mutationActive = operation === 'sending' || operation === 'retrying' || operation === 'clearing'
  const hasMessages = messages.length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border/40 bg-canvas px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface-raised text-accent shadow-innerBorder">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xl font-semibold tracking-tight text-foreground">Ella</div>
              <div className="text-sm text-muted-foreground">Assistente deste servidor</div>
            </div>
          </div>
          <Button
            ref={clearTriggerRef}
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirmClear(true)}
            disabled={mutationActive || historyLoading || !hasMessages}
            className="gap-1.5 text-xs"
            aria-label={mutationActive ? 'Nova conversa indisponível durante uma resposta' : 'Nova conversa'}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Nova conversa
          </Button>
        </div>

        {showConfirmClear && (
          <div
            ref={clearDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescriptionId}
            className="mt-3 flex items-center gap-3 rounded-lg border border-border/60 bg-surface-raised px-4 py-3 text-sm"
          >
            <span id={dialogTitleId} className="sr-only">Encerrar conversa</span>
            <span id={dialogDescriptionId} className="text-muted-foreground">
              Tem certeza que deseja encerrar esta conversa?
            </span>
            <Button variant="solid" size="sm" onClick={handleClear} disabled={operation === 'clearing'} className="h-7 px-3 text-xs">
              {operation === 'clearing' ? 'Encerrando...' : 'Encerrar'}
            </Button>
            <Button ref={cancelClearRef} variant="ghost" size="sm" onClick={closeClearDialog} disabled={operation === 'clearing'} className="h-7 px-3 text-xs">
              Cancelar
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5" data-testid="conversation-scroll-container">
        <div className="mx-auto max-w-3xl">
          {historyLoading && (
            <div className="space-y-4 py-4" aria-label="Carregando histórico">
              <div className="flex items-start gap-3"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-48" /></div>
              <div className="flex items-start gap-3"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-64" /></div>
            </div>
          )}

          {!historyLoading && historyError && (
            <div className="py-4">
              <PanelAssistantError message={historyError} onRetry={reloadHistory} />
            </div>
          )}

          {!historyLoading && messages.length === 0 && !historyError && (
            <PanelAssistantEmptyState
              disabled={operation !== 'idle'}
              quickPrompts={QUICK_PROMPTS.map((label) => ({ label, onClick: () => send(label) }))}
            />
          )}

          {messages.map((message) => (
            <PanelAssistantMessage
              key={message.id}
              role={message.status === 'thinking' ? 'thinking' : message.status === 'error' ? 'error' : message.role}
              content={message.content}
              isError={message.status === 'error'}
              onRetry={message.status === 'error' ? () => retry(message.turnId) : undefined}
              retryDisabled={operation !== 'idle'}
              className="py-2"
            />
          ))}

          {hasMessages && <div className="h-4" />}
          <div ref={conversationEndRef} data-testid="conversation-end" />
        </div>
      </div>

      <div className="shrink-0 border-t border-border/40 bg-canvas px-4 py-3 sm:px-5">
        <div className="mx-auto max-w-3xl">
          <PanelAssistantComposer
            ref={composerRef}
            value={draft}
            onChange={setDraft}
            onSend={() => send()}
            disabled={operation !== 'idle' || !!historyError || !activeGuildId}
            loading={operation === 'sending' || operation === 'retrying'}
            className="shadow-innerBorder"
          />
          <div className="mt-1.5 px-1 text-[11px] text-muted-foreground/50">
            Enter para enviar · Shift+Enter para quebrar linha
          </div>
        </div>
      </div>
    </div>
  )
}
