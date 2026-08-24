import * as React from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import {
  build_panel_ai_page_path,
  type panel_ai_action,
  type panel_ai_page_key,
  type panel_ai_sensitive_request,
} from '@yuebot/shared'

import { getApiUrl } from '../../env'
import { usePanelAssistant } from '../../hooks/usePanelAssistant'
import { toast_error, toast_success } from '../../store/toast'
import { resolvePanelAiPageContext } from './resolvePageKey'

const API_URL = getApiUrl()
const GENERIC_HISTORY_ERROR = 'Não foi possível carregar o histórico.'
const GENERIC_SEND_ERROR = 'Não foi possível enviar sua mensagem. Tente novamente.'

export type panel_assistant_operation =
  | 'idle'
  | 'loading-history'
  | 'sending'
  | 'retrying'
  | 'confirming-sensitive'
  | 'clearing'

export type panel_assistant_message = {
  id: string
  turnId: string
  role: 'user' | 'assistant'
  content: string
  status: 'complete' | 'thinking' | 'error'
  actions?: panel_ai_action[]
  sensitiveRequest?: panel_ai_sensitive_request | null
}

type history_entry = Pick<panel_assistant_message, 'role' | 'content'>

export type panel_assistant_context_value = {
  activeGuildId: string | undefined
  activePageKey: panel_ai_page_key | null
  messages: panel_assistant_message[]
  operation: panel_assistant_operation
  historyLoading: boolean
  historyError: string | null
  draft: string
  setDraft: (value: string) => void
  reloadHistory: () => void
  send: (text?: string) => void
  retry: (turnId: string) => void
  executeAction: (action: panel_ai_action) => void
  confirmSensitive: (turnId: string, requestId: string) => void
  declineSensitive: (turnId: string, requestId: string) => void
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

function normalize_text(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

function find_visible_target(label: string): HTMLElement | null {
  const expected = normalize_text(label)
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>('label, button, h1, h2, h3, h4, [role="heading"], span, p, div'),
  ).filter((element) => element.offsetParent !== null && element.textContent)

  return elements.find((element) => normalize_text(element.textContent ?? '') === expected)
    ?? elements.find((element) => {
      const text = normalize_text(element.textContent ?? '')
      return text.length <= expected.length + 40 && text.includes(expected)
    })
    ?? null
}

function reveal_panel_target(label: string, highlight: boolean, attempt = 0) {
  const element = find_visible_target(label)
  if (!element) {
    if (attempt < 6) window.setTimeout(() => reveal_panel_target(label, highlight, attempt + 1), 100)
    return
  }

  element.scrollIntoView({
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center',
  })

  if (!highlight) return
  const originalOutline = element.style.outline
  const originalOffset = element.style.outlineOffset
  element.style.outline = '2px solid currentColor'
  element.style.outlineOffset = '6px'
  window.setTimeout(() => {
    if (!element.isConnected) return
    element.style.outline = originalOutline
    element.style.outlineOffset = originalOffset
  }, 1_800)
}

export function PanelAssistantProvider({ children }: React.PropsWithChildren) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeGuildId = getPanelAssistantGuildId(pathname)
  const activePageContext = resolvePanelAiPageContext(pathname)
  const activePageKey = activePageContext?.pageKey ?? null
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
    activeGuildId ? 'loading-history' : 'idle',
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
    assistantMessageId: string,
    message: string,
    requestOperation: 'sending' | 'retrying',
    pageContext: ReturnType<typeof resolvePanelAiPageContext>,
  ) => {
    if (!activeGuildId || operationRef.current !== requestOperation) return

    const targetGuildId = activeGuildId
    const controller = new AbortController()
    chatControllerRef.current = controller
    const requestId = ++chatRequestIdRef.current
    let streamed = false
    const result = await assistant.send(message, controller.signal, pageContext ?? undefined, (delta) => {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestId !== chatRequestIdRef.current ||
        targetGuildId !== currentGuildRef.current
      ) return
      streamed = true
      setMessages((current) => current.map((item) =>
        item.id === assistantMessageId
          ? { ...item, content: `${item.content}${delta}`, status: 'complete' }
          : item
      ))
      setScrollVersion((version) => version + 1)
    })

    if (
      !mountedRef.current ||
      controller.signal.aborted ||
      requestId !== chatRequestIdRef.current ||
      targetGuildId !== currentGuildRef.current
    ) return

    if (result.ok) {
      setMessages((current) => current.map((item) =>
        item.id === assistantMessageId
          ? {
              ...item,
              content: result.response,
              status: 'complete',
              actions: result.actions,
              sensitiveRequest: result.sensitiveRequest,
            }
          : item
      ))
    } else if (result.error !== 'Cancelled') {
      setMessages((current) => current.map((item) =>
        item.id === assistantMessageId
          ? {
              ...item,
              content: streamed ? item.content : (result.error || GENERIC_SEND_ERROR),
              status: 'error',
              actions: [],
              sensitiveRequest: null,
            }
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
    const assistantMessageId = `${turnId}-assistant`
    setMessages((current) => [
      ...current,
      { id: `${turnId}-user`, turnId, role: 'user', content: message, status: 'complete' },
      { id: assistantMessageId, turnId, role: 'assistant', content: '', status: 'thinking' },
    ])
    setDraft('')
    setScrollVersion((version) => version + 1)
    void finishTurn(assistantMessageId, message, 'sending', activePageContext)
  }, [activeGuildId, activePageContext, draft, finishTurn, historyError, setOperation])

  const retry = React.useCallback((turnId: string) => {
    if (!activeGuildId || operationRef.current !== 'idle') return
    const userMessage = messages.find((item) => item.turnId === turnId && item.role === 'user')
    const errorMessage = messages.find((item) => item.turnId === turnId && item.status === 'error')
    if (!userMessage || !errorMessage) return

    setOperation('retrying')
    setMessages((current) => current.map((item) =>
      item.id === errorMessage.id
        ? { ...item, content: '', status: 'thinking', actions: [], sensitiveRequest: null }
        : item
    ))
    setScrollVersion((version) => version + 1)
    void finishTurn(errorMessage.id, userMessage.content, 'retrying', activePageContext)
  }, [activeGuildId, activePageContext, finishTurn, messages, setOperation])

  const executeAction = React.useCallback((action: panel_ai_action) => {
    if (!activeGuildId) return
    const path = build_panel_ai_page_path(action.pageKey, activeGuildId)
    if (!path) return

    const currentPath = pathname.split('?')[0].split('#')[0].replace(/\/$/, '') || '/'
    const targetPath = path.replace(/\/$/, '') || '/'
    if (currentPath !== targetPath) navigate(path)

    if (action.type === 'open_section' || action.type === 'highlight_setting') {
      window.setTimeout(
        () => reveal_panel_target(action.targetLabel, action.type === 'highlight_setting'),
        currentPath === targetPath ? 0 : 100,
      )
    }
  }, [activeGuildId, navigate, pathname])

  const declineSensitive = React.useCallback((turnId: string, requestId: string) => {
    if (operationRef.current !== 'idle') return
    setMessages((current) => current.map((item) =>
      item.turnId === turnId && item.sensitiveRequest?.id === requestId
        ? { ...item, sensitiveRequest: null }
        : item
    ))
  }, [])

  const confirmSensitive = React.useCallback((turnId: string, requestId: string) => {
    if (!activeGuildId || operationRef.current !== 'idle') return
    const source = messages.find((item) => item.turnId === turnId && item.sensitiveRequest?.id === requestId)
    if (!source) return

    setOperation('confirming-sensitive')
    setMessages((current) => current.map((item) =>
      item.id === source.id ? { ...item, sensitiveRequest: null } : item
    ))

    const continuationTurnId = `${activeGuildId}-sensitive-${++messageIdRef.current}`
    const assistantMessageId = `${continuationTurnId}-assistant`
    setMessages((current) => [
      ...current,
      { id: assistantMessageId, turnId: continuationTurnId, role: 'assistant', content: '', status: 'thinking' },
    ])
    setScrollVersion((version) => version + 1)

    const controller = new AbortController()
    chatControllerRef.current = controller
    const requestSequence = ++chatRequestIdRef.current
    const targetGuildId = activeGuildId

    void (async () => {
      let streamed = false
      const result = await assistant.confirmSensitive(requestId, controller.signal, (delta) => {
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          requestSequence !== chatRequestIdRef.current ||
          targetGuildId !== currentGuildRef.current
        ) return
        streamed = true
        setMessages((current) => current.map((item) =>
          item.id === assistantMessageId
            ? { ...item, content: `${item.content}${delta}`, status: 'complete' }
            : item
        ))
        setScrollVersion((version) => version + 1)
      })

      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestSequence !== chatRequestIdRef.current ||
        targetGuildId !== currentGuildRef.current
      ) return

      if (result.ok) {
        setMessages((current) => current.map((item) =>
          item.id === assistantMessageId
            ? { ...item, content: result.response, status: 'complete', actions: result.actions }
            : item
        ))
      } else if (result.error !== 'Cancelled') {
        setMessages((current) => current.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: streamed ? item.content : (result.error || GENERIC_SEND_ERROR),
                status: 'error',
              }
            : item
        ))
        toast_error(result.error || GENERIC_SEND_ERROR, 'Ella')
      }

      setScrollVersion((version) => version + 1)
      setFocusVersion((version) => version + 1)
      setOperation('idle')
      chatControllerRef.current = null
    })()
  }, [activeGuildId, assistant, messages, setOperation])

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
    activePageKey,
    messages: visibleMessages,
    operation,
    historyLoading: stateGuildId !== activeGuildId || operation === 'loading-history',
    historyError: stateGuildId === activeGuildId ? historyError : null,
    draft,
    setDraft,
    reloadHistory,
    send,
    retry,
    executeAction,
    confirmSensitive,
    declineSensitive,
    clearConversation,
    scrollVersion,
    focusVersion,
  }), [
    activeGuildId,
    activePageKey,
    clearConversation,
    confirmSensitive,
    declineSensitive,
    draft,
    executeAction,
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
