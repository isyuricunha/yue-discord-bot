import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Sparkles, Trash2 } from 'lucide-react'

import { getApiUrl } from '../env'
import { toast_error, toast_success } from '../store/toast'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { usePanelAssistant } from '../hooks/usePanelAssistant'
import { PanelAssistantComposer } from '../components/panel-ai/PanelAssistantComposer'
import { PanelAssistantEmptyState } from '../components/panel-ai/PanelAssistantEmptyState'
import { PanelAssistantError } from '../components/panel-ai/PanelAssistantError'
import { PanelAssistantMessage } from '../components/panel-ai/PanelAssistantMessage'

const API_URL = getApiUrl()
const GENERIC_HISTORY_ERROR = 'Não foi possível carregar o histórico.'
const GENERIC_SEND_ERROR = 'Não foi possível enviar sua mensagem. Tente novamente.'

const QUICK_PROMPTS = [
  'Quais recursos posso configurar aqui?',
  'Como funciona o Anti-Raide?',
  'Revise as configurações deste servidor',
  'Como configurar as boas-vindas?',
]

type history_entry = { role: 'user' | 'assistant'; content: string }
type operation = 'idle' | 'loading-history' | 'sending' | 'retrying' | 'clearing'
type chat_message = history_entry & {
  id: string
  turnId: string
  status: 'complete' | 'thinking' | 'error'
}

function isHistoryEntry(value: unknown): value is history_entry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    (entry.role === 'user' || entry.role === 'assistant') &&
    typeof entry.content === 'string' &&
    !('_error' in entry) &&
    !('_thinkingId' in entry)
  )
}

function parseHistoryPayload(value: unknown): history_entry[] | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as Record<string, unknown>
  if (payload.success !== true || !Array.isArray(payload.messages) || !payload.messages.every(isHistoryEntry)) {
    return null
  }
  return payload.messages.map(({ role, content }) => ({ role, content }))
}

function buildHistoryMessages(entries: history_entry[], guildId: string): chat_message[] {
  let turnNumber = 0
  let activeTurnId = `${guildId}-history-${turnNumber}`

  return entries.map((entry, index) => {
    if (entry.role === 'user' || index === 0) {
      activeTurnId = `${guildId}-history-${turnNumber++}`
    }
    return {
      ...entry,
      id: `${guildId}-history-message-${index}`,
      turnId: activeTurnId,
      status: 'complete',
    }
  })
}

export default function PanelAssistantPage() {
  const { guildId } = useParams<{ guildId: string }>()
  const assistant = usePanelAssistant(guildId)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const clearTriggerRef = useRef<HTMLButtonElement>(null)
  const cancelClearRef = useRef<HTMLButtonElement>(null)
  const clearDialogRef = useRef<HTMLDivElement>(null)
  const historyControllerRef = useRef<AbortController | null>(null)
  const chatControllerRef = useRef<AbortController | null>(null)
  const historyRequestIdRef = useRef(0)
  const chatRequestIdRef = useRef(0)
  const messageIdRef = useRef(0)
  const currentGuildRef = useRef(guildId)
  const operationRef = useRef<operation>('loading-history')
  const restoreComposerFocusRef = useRef(false)
  const dialogTitleId = useId()
  const dialogDescriptionId = useId()

  const [stateGuildId, setStateGuildId] = useState(guildId)
  const [composerValue, setComposerValue] = useState('')
  const [messages, setMessages] = useState<chat_message[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [operation, setOperationState] = useState<operation>('loading-history')
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [scrollVersion, setScrollVersion] = useState(0)

  const setOperation = useCallback((nextOperation: operation) => {
    operationRef.current = nextOperation
    setOperationState(nextOperation)
  }, [])

  const requestComposerFocus = useCallback(() => {
    restoreComposerFocusRef.current = true
  }, [])

  useLayoutEffect(() => {
    if (operation === 'idle' && restoreComposerFocusRef.current) {
      restoreComposerFocusRef.current = false
      composerRef.current?.focus()
    }
  }, [operation])

  useEffect(() => {
    if (scrollVersion === 0) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    conversationEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' })
  }, [scrollVersion])

  const loadHistory = useCallback(async (targetGuildId: string) => {
    historyControllerRef.current?.abort()
    const controller = new AbortController()
    historyControllerRef.current = controller
    const requestId = ++historyRequestIdRef.current

    setStateGuildId(targetGuildId)
    setMessages([])
    setHistoryError(null)
    setOperation('loading-history')

    try {
      const response = await fetch(`${API_URL}/api/guilds/${targetGuildId}/panel-ai/history`, {
        credentials: 'include',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(GENERIC_HISTORY_ERROR)
      const payload = parseHistoryPayload(await response.json().catch(() => null))
      if (!payload) throw new Error(GENERIC_HISTORY_ERROR)

      if (
        controller.signal.aborted ||
        requestId !== historyRequestIdRef.current ||
        targetGuildId !== currentGuildRef.current
      ) return

      setMessages(buildHistoryMessages(payload, targetGuildId))
      setOperation('idle')
    } catch {
      if (
        controller.signal.aborted ||
        requestId !== historyRequestIdRef.current ||
        targetGuildId !== currentGuildRef.current
      ) return
      setHistoryError(GENERIC_HISTORY_ERROR)
      setOperation('idle')
    }
  }, [setOperation])

  useLayoutEffect(() => {
    currentGuildRef.current = guildId
    historyControllerRef.current?.abort()
    chatControllerRef.current?.abort()
    historyRequestIdRef.current += 1
    chatRequestIdRef.current += 1
    restoreComposerFocusRef.current = false
    setStateGuildId(guildId)
    setMessages([])
    setHistoryError(null)
    setComposerValue('')
    setShowConfirmClear(false)

    if (guildId) void loadHistory(guildId)
    else setOperation('idle')

    return () => {
      historyControllerRef.current?.abort()
      chatControllerRef.current?.abort()
    }
  }, [guildId, loadHistory, setOperation])

  const finishTurn = useCallback(
    async (turnId: string, message: string, requestOperation: 'sending' | 'retrying') => {
      if (!guildId || operationRef.current !== requestOperation) return

      const targetGuildId = guildId
      const controller = new AbortController()
      chatControllerRef.current = controller
      const requestId = ++chatRequestIdRef.current

      const result = await assistant.send(message, controller.signal)
      if (
        controller.signal.aborted ||
        requestId !== chatRequestIdRef.current ||
        targetGuildId !== currentGuildRef.current
      ) return

      if (result.ok) {
        setMessages((current) => current.map((item) =>
          item.turnId === turnId && item.status !== 'complete'
            ? { ...item, content: result.response, status: 'complete' }
            : item
        ))
      } else if (result.error !== 'Cancelled') {
        setMessages((current) => current.map((item) =>
          item.turnId === turnId && item.status !== 'complete'
            ? { ...item, content: result.error || GENERIC_SEND_ERROR, status: 'error' }
            : item
        ))
        toast_error(result.error || GENERIC_SEND_ERROR, 'Ella')
      }

      setScrollVersion((version) => version + 1)
      requestComposerFocus()
      setOperation('idle')
      chatControllerRef.current = null
    },
    [assistant, guildId, requestComposerFocus, setOperation]
  )

  const handleSend = useCallback((text?: string) => {
    const message = (text ?? composerValue).trim()
    if (!message || !guildId || operationRef.current !== 'idle' || historyError) return

    setOperation('sending')
    const turnId = `${guildId}-turn-${++messageIdRef.current}`
    setMessages((current) => [
      ...current,
      { id: `${turnId}-user`, turnId, role: 'user', content: message, status: 'complete' },
      { id: `${turnId}-assistant`, turnId, role: 'assistant', content: '', status: 'thinking' },
    ])
    setComposerValue('')
    setScrollVersion((version) => version + 1)
    void finishTurn(turnId, message, 'sending')
  }, [composerValue, finishTurn, guildId, historyError, setOperation])

  const handleRetry = useCallback((turnId: string) => {
    if (!guildId || operationRef.current !== 'idle') return
    const userMessage = messages.find((item) => item.turnId === turnId && item.role === 'user')
    const errorMessage = messages.find((item) => item.turnId === turnId && item.status === 'error')
    if (!userMessage || !errorMessage) return

    setOperation('retrying')
    setMessages((current) => current.map((item) =>
      item.id === errorMessage.id ? { ...item, content: '', status: 'thinking' } : item
    ))
    setScrollVersion((version) => version + 1)
    void finishTurn(turnId, userMessage.content, 'retrying')
  }, [finishTurn, guildId, messages, setOperation])

  const handleClear = useCallback(async () => {
    if (!guildId || operationRef.current !== 'idle') return
    const targetGuildId = guildId
    setOperation('clearing')

    try {
      const response = await fetch(`${API_URL}/api/guilds/${targetGuildId}/panel-ai/history`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Falha ao limpar')
      if (targetGuildId !== currentGuildRef.current) return

      chatControllerRef.current?.abort()
      chatRequestIdRef.current += 1
      setMessages([])
      setShowConfirmClear(false)
      toast_success('Conversa encerrada.', 'Ella')
      requestComposerFocus()
    } catch {
      if (targetGuildId === currentGuildRef.current) {
        toast_error('Não foi possível limpar a conversa.', 'Ella')
      }
    } finally {
      if (targetGuildId === currentGuildRef.current) setOperation('idle')
    }
  }, [guildId, requestComposerFocus, setOperation])

  const closeClearDialog = useCallback(() => {
    setShowConfirmClear(false)
    clearTriggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!showConfirmClear) return
    cancelClearRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && operationRef.current !== 'clearing') {
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
  }, [closeClearDialog, showConfirmClear])

  const visibleMessages = stateGuildId === guildId ? messages : []
  const historyLoading = stateGuildId !== guildId || operation === 'loading-history'
  const mutationActive = operation === 'sending' || operation === 'retrying' || operation === 'clearing'
  const hasMessages = visibleMessages.length > 0

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
              <PanelAssistantError message={historyError} onRetry={() => guildId && loadHistory(guildId)} />
            </div>
          )}

          {!historyLoading && visibleMessages.length === 0 && !historyError && (
            <PanelAssistantEmptyState
              disabled={operation !== 'idle'}
              quickPrompts={QUICK_PROMPTS.map((label) => ({ label, onClick: () => handleSend(label) }))}
            />
          )}

          {visibleMessages.map((message) => (
            <PanelAssistantMessage
              key={message.id}
              role={message.status === 'thinking' ? 'thinking' : message.status === 'error' ? 'error' : message.role}
              content={message.content}
              isError={message.status === 'error'}
              onRetry={message.status === 'error' ? () => handleRetry(message.turnId) : undefined}
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
            value={composerValue}
            onChange={setComposerValue}
            onSend={() => handleSend()}
            disabled={operation !== 'idle' || !!historyError}
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
