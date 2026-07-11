import * as React from 'react'
import { matchPath, useLocation } from 'react-router-dom'

import { getApiUrl } from '../../env'
import { usePanelAssistant } from '../../hooks/usePanelAssistant'
import { toast_error, toast_success } from '../../store/toast'

const API_URL = getApiUrl()
const GENERIC_HISTORY_ERROR = 'Não foi possível carregar o histórico.'
const GENERIC_SEND_ERROR = 'Não foi possível enviar sua mensagem. Tente novamente.'

export type panel_assistant_operation = 'idle' | 'loading-history' | 'sending' | 'retrying' | 'clearing'

export type panel_assistant_message = {
  id: string
  turnId: string
  role: 'user' | 'assistant'
  content: string
  status: 'complete' | 'thinking' | 'error'
}

type history_entry = Pick<panel_assistant_message, 'role' | 'content'>

export type panel_assistant_context_value = {
  activeGuildId: string | undefined
  messages: panel_assistant_message[]
  operation: panel_assistant_operation
  historyLoading: boolean
  historyError: string | null
  draft: string
  setDraft: (value: string) => void
  reloadHistory: () => void
  send: (text?: string) => void
  retry: (turnId: string) => void
  clearConversation: () => Promise<boolean>
  scrollVersion: number
  focusVersion: number
}

const PanelAssistantContext = React.createContext<panel_assistant_context_value | null>(null)

export function getPanelAssistantGuildId(pathname: string): string | undefined {
  const match = matchPath({ path: '/guild/:guildId/*', end: false }, pathname)
  const guildId = match?.params.guildId?.trim()
  return guildId || undefined
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

function buildHistoryMessages(entries: history_entry[], guildId: string): panel_assistant_message[] {
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

export function PanelAssistantProvider({ children }: React.PropsWithChildren) {
  const { pathname } = useLocation()
  const activeGuildId = getPanelAssistantGuildId(pathname)
  const assistant = usePanelAssistant(activeGuildId)
  const historyControllerRef = React.useRef<AbortController | null>(null)
  const chatControllerRef = React.useRef<AbortController | null>(null)
  const clearControllerRef = React.useRef<AbortController | null>(null)
  const historyRequestIdRef = React.useRef(0)
  const chatRequestIdRef = React.useRef(0)
  const clearRequestIdRef = React.useRef(0)
  const messageIdRef = React.useRef(0)
  const currentGuildRef = React.useRef(activeGuildId)
  const operationRef = React.useRef<panel_assistant_operation>(activeGuildId ? 'loading-history' : 'idle')
  const mountedRef = React.useRef(false)

  const [stateGuildId, setStateGuildId] = React.useState(activeGuildId)
  const [messages, setMessages] = React.useState<panel_assistant_message[]>([])
  const [historyError, setHistoryError] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [operation, setOperationState] = React.useState<panel_assistant_operation>(
    activeGuildId ? 'loading-history' : 'idle'
  )
  const [scrollVersion, setScrollVersion] = React.useState(0)
  const [focusVersion, setFocusVersion] = React.useState(0)

  const setOperation = React.useCallback((nextOperation: panel_assistant_operation) => {
    operationRef.current = nextOperation
    setOperationState(nextOperation)
  }, [])

  const loadHistory = React.useCallback(async (targetGuildId: string) => {
    historyControllerRef.current?.abort()
    const controller = new AbortController()
    historyControllerRef.current = controller
    const requestId = ++historyRequestIdRef.current

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
        !mountedRef.current ||
        controller.signal.aborted ||
        requestId !== historyRequestIdRef.current ||
        targetGuildId !== currentGuildRef.current
      ) return

      setMessages(buildHistoryMessages(payload, targetGuildId))
      setOperation('idle')
    } catch {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestId !== historyRequestIdRef.current ||
        targetGuildId !== currentGuildRef.current
      ) return
      setHistoryError(GENERIC_HISTORY_ERROR)
      setOperation('idle')
    }
  }, [setOperation])

  React.useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      historyControllerRef.current?.abort()
      chatControllerRef.current?.abort()
      clearControllerRef.current?.abort()
      clearControllerRef.current = null
      historyRequestIdRef.current += 1
      chatRequestIdRef.current += 1
      clearRequestIdRef.current += 1
    }
  }, [])

  React.useLayoutEffect(() => {
    currentGuildRef.current = activeGuildId
    historyControllerRef.current?.abort()
    chatControllerRef.current?.abort()
    clearControllerRef.current?.abort()
    clearControllerRef.current = null
    historyRequestIdRef.current += 1
    chatRequestIdRef.current += 1
    clearRequestIdRef.current += 1
    setStateGuildId(activeGuildId)
    setMessages([])
    setHistoryError(null)
    setDraft('')

    if (!activeGuildId) {
      setOperation('idle')
      return
    }

    setOperation('loading-history')
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled && mountedRef.current && currentGuildRef.current === activeGuildId) {
        void loadHistory(activeGuildId)
      }
    })
    return () => { cancelled = true }
  }, [activeGuildId, loadHistory, setOperation])

  const finishTurn = React.useCallback(async (
    turnId: string,
    message: string,
    requestOperation: 'sending' | 'retrying',
  ) => {
    if (!activeGuildId || operationRef.current !== requestOperation) return

    const targetGuildId = activeGuildId
    const controller = new AbortController()
    chatControllerRef.current = controller
    const requestId = ++chatRequestIdRef.current
    const result = await assistant.send(message, controller.signal)

    if (
      !mountedRef.current ||
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
    setFocusVersion((version) => version + 1)
    setOperation('idle')
    chatControllerRef.current = null
  }, [activeGuildId, assistant, setOperation])

  const send = React.useCallback((text?: string) => {
    const message = (text ?? draft).trim()
    if (!message || !activeGuildId || operationRef.current !== 'idle' || historyError) return

    setOperation('sending')
    const turnId = `${activeGuildId}-turn-${++messageIdRef.current}`
    setMessages((current) => [
      ...current,
      { id: `${turnId}-user`, turnId, role: 'user', content: message, status: 'complete' },
      { id: `${turnId}-assistant`, turnId, role: 'assistant', content: '', status: 'thinking' },
    ])
    setDraft('')
    setScrollVersion((version) => version + 1)
    void finishTurn(turnId, message, 'sending')
  }, [activeGuildId, draft, finishTurn, historyError, setOperation])

  const retry = React.useCallback((turnId: string) => {
    if (!activeGuildId || operationRef.current !== 'idle') return
    const userMessage = messages.find((item) => item.turnId === turnId && item.role === 'user')
    const errorMessage = messages.find((item) => item.turnId === turnId && item.status === 'error')
    if (!userMessage || !errorMessage) return

    setOperation('retrying')
    setMessages((current) => current.map((item) =>
      item.id === errorMessage.id ? { ...item, content: '', status: 'thinking' } : item
    ))
    setScrollVersion((version) => version + 1)
    void finishTurn(turnId, userMessage.content, 'retrying')
  }, [activeGuildId, finishTurn, messages, setOperation])

  const clearConversation = React.useCallback(async () => {
    if (!activeGuildId || operationRef.current !== 'idle') return false
    const targetGuildId = activeGuildId
    const controller = new AbortController()
    clearControllerRef.current = controller
    const requestId = ++clearRequestIdRef.current
    setOperation('clearing')

    const isCurrentRequest = () => (
      mountedRef.current &&
      !controller.signal.aborted &&
      requestId === clearRequestIdRef.current &&
      targetGuildId === currentGuildRef.current
    )

    try {
      const response = await fetch(`${API_URL}/api/guilds/${targetGuildId}/panel-ai/history`, {
        method: 'DELETE',
        credentials: 'include',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Falha ao limpar')
      if (!isCurrentRequest()) return false

      chatControllerRef.current?.abort()
      chatRequestIdRef.current += 1
      setMessages([])
      toast_success('Conversa encerrada.', 'Ella')
      setFocusVersion((version) => version + 1)
      return true
    } catch {
      if (!isCurrentRequest()) return false
      toast_error('Não foi possível limpar a conversa.', 'Ella')
      return false
    } finally {
      if (isCurrentRequest()) {
        if (clearControllerRef.current === controller) clearControllerRef.current = null
        setOperation('idle')
      }
    }
  }, [activeGuildId, setOperation])

  const reloadHistory = React.useCallback(() => {
    if (activeGuildId && operationRef.current === 'idle') void loadHistory(activeGuildId)
  }, [activeGuildId, loadHistory])

  const visibleMessages = stateGuildId === activeGuildId ? messages : []
  const value = React.useMemo<panel_assistant_context_value>(() => ({
    activeGuildId,
    messages: visibleMessages,
    operation,
    historyLoading: stateGuildId !== activeGuildId || operation === 'loading-history',
    historyError: stateGuildId === activeGuildId ? historyError : null,
    draft,
    setDraft,
    reloadHistory,
    send,
    retry,
    clearConversation,
    scrollVersion,
    focusVersion,
  }), [
    activeGuildId,
    clearConversation,
    draft,
    focusVersion,
    historyError,
    operation,
    reloadHistory,
    retry,
    scrollVersion,
    send,
    stateGuildId,
    visibleMessages,
  ])

  return <PanelAssistantContext.Provider value={value}>{children}</PanelAssistantContext.Provider>
}

export function usePanelAssistantContext(): panel_assistant_context_value {
  const context = React.useContext(PanelAssistantContext)
  if (!context) {
    throw new Error('usePanelAssistantContext must be used within PanelAssistantProvider')
  }
  return context
}
