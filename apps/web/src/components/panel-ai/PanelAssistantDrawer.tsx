import * as React from 'react'
import { Maximize2, Sparkles, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useMediaQuery } from '../../hooks/use_media_query'
import { cn } from '../../lib/cn'
import { getTabbableElements } from '../../lib/tabbable'
import { useCommandPaletteStore } from '../../store/command_palette'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { PanelAssistantComposer } from './PanelAssistantComposer'
import { PanelAssistantEmptyState } from './PanelAssistantEmptyState'
import { PanelAssistantError } from './PanelAssistantError'
import { PanelAssistantMessage } from './PanelAssistantMessage'
import { usePanelAssistantContext } from './PanelAssistantProvider'

const DRAWER_ID = 'ella-drawer'
const MOBILE_QUERY = '(max-width: 768px)'
const QUICK_PROMPTS = [
  'Quais recursos posso configurar aqui?',
  'Como funciona o Anti-Raide?',
  'Revise as configurações deste servidor',
  'Como configurar as boas-vindas?',
]

type props = {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

export function PanelAssistantDrawer({ open, onClose, triggerRef }: props) {
  const assistant = usePanelAssistantContext()
  const commandPaletteOpen = useCommandPaletteStore((state) => state.isOpen)
  const navigate = useNavigate()
  const mobile = useMediaQuery(MOBILE_QUERY)
  const composerRef = React.useRef<HTMLTextAreaElement>(null)
  const endRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLElement>(null)
  const clearTriggerRef = React.useRef<HTMLButtonElement>(null)
  const cancelClearRef = React.useRef<HTMLButtonElement>(null)
  const closeButtonRef = React.useRef<HTMLButtonElement>(null)
  const wasOpenRef = React.useRef(false)
  const focusFrameRef = React.useRef<number | null>(null)
  const previousGuildRef = React.useRef(assistant.activeGuildId)
  const previousHistoryLoadingRef = React.useRef(assistant.historyLoading)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const confirmationTitleId = React.useId()
  const confirmationDescriptionId = React.useId()
  const pendingFocusRef = React.useRef<'clear-trigger' | null>(null)
  const confirmClearRef = React.useRef(confirmClear)
  const scrollSeen = React.useRef(assistant.scrollVersion)
  const focusSeen = React.useRef(assistant.focusVersion)
  const mutation = assistant.operation === 'sending' || assistant.operation === 'retrying' || assistant.operation === 'clearing'

  const scrollToLatest = React.useCallback(() => {
    endRef.current?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }, [])

  React.useLayoutEffect(() => {
    confirmClearRef.current = confirmClear
  }, [confirmClear])

  React.useEffect(() => {
    return () => {
      pendingFocusRef.current = null
    }
  }, [])

  const focusMobileDrawer = React.useCallback(() => {
    if (confirmClearRef.current && cancelClearRef.current && !cancelClearRef.current.disabled) cancelClearRef.current.focus()
    else if (composerRef.current && !composerRef.current.disabled) composerRef.current.focus()
    else closeButtonRef.current?.focus()
  }, [])

  const closeConfirmation = React.useCallback(() => {
    pendingFocusRef.current = 'clear-trigger'
    setConfirmClear(false)
  }, [])

  const close = React.useCallback(() => {
    pendingFocusRef.current = null
    setConfirmClear(false)
    onClose()
  }, [onClose])

  React.useLayoutEffect(() => {
    if (previousGuildRef.current !== assistant.activeGuildId) {
      pendingFocusRef.current = null
      setConfirmClear(false)
      scrollContainerRef.current?.scrollTo({ top: 0 })
    }
    previousGuildRef.current = assistant.activeGuildId
  }, [assistant.activeGuildId])

  React.useLayoutEffect(() => {
    if (pendingFocusRef.current === 'clear-trigger') {
      if (clearTriggerRef.current?.isConnected) {
        clearTriggerRef.current.focus()
      }
      pendingFocusRef.current = null
    }
  })

  React.useEffect(() => {
    if (!confirmClear || commandPaletteOpen) return
    const frame = requestAnimationFrame(() => {
      if (!useCommandPaletteStore.getState().isOpen) cancelClearRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [commandPaletteOpen, confirmClear])

  React.useEffect(() => {
    if (!open) {
      if (wasOpenRef.current && triggerRef.current?.isConnected) triggerRef.current.focus()
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return
    wasOpenRef.current = true
    scrollSeen.current = assistant.scrollVersion
    focusSeen.current = assistant.focusVersion
    if (!assistant.historyLoading) scrollToLatest()
    if (!mobile && !commandPaletteOpen && assistant.operation === 'idle') {
      focusFrameRef.current = requestAnimationFrame(() => composerRef.current?.focus())
    }
    return () => {
      if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current)
      focusFrameRef.current = null
    }
  }, [assistant.historyLoading, commandPaletteOpen, mobile, open, scrollToLatest])

  React.useLayoutEffect(() => {
    if (!open || !mobile || commandPaletteOpen) return
    focusMobileDrawer()
  }, [commandPaletteOpen, focusMobileDrawer, mobile, open])

  React.useEffect(() => {
    const wasLoading = previousHistoryLoadingRef.current
    previousHistoryLoadingRef.current = assistant.historyLoading
    if (open && wasLoading && !assistant.historyLoading) scrollToLatest()
  }, [assistant.historyLoading, open, scrollToLatest])

  React.useEffect(() => {
    if (!open || assistant.scrollVersion === scrollSeen.current) return
    scrollSeen.current = assistant.scrollVersion
    scrollToLatest()
  }, [assistant.scrollVersion, open, scrollToLatest])

  React.useEffect(() => {
    if (commandPaletteOpen) focusSeen.current = assistant.focusVersion
  }, [assistant.focusVersion, commandPaletteOpen])

  React.useLayoutEffect(() => {
    if (commandPaletteOpen || !open || assistant.operation !== 'idle' || assistant.focusVersion === focusSeen.current) return
    focusSeen.current = assistant.focusVersion
    composerRef.current?.focus()
  }, [assistant.focusVersion, assistant.operation, commandPaletteOpen, open])

  React.useEffect(() => {
    if (!open || !mobile) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [mobile, open])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (commandPaletteOpen) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (confirmClear && assistant.operation !== 'clearing') closeConfirmation()
        else if (!confirmClear) close()
        return
      }
      if (!mobile || event.key !== 'Tab' || !panelRef.current) return
      const controls = getTabbableElements(panelRef.current)
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [assistant.operation, close, closeConfirmation, commandPaletteOpen, confirmClear, mobile, open])

  if (!open) return null

  const clear = async () => {
    if (await assistant.clearConversation()) {
      pendingFocusRef.current = null
      setConfirmClear(false)
    }
  }

  const expand = () => {
    if (!assistant.activeGuildId) return
    close()
    navigate(`/guild/${assistant.activeGuildId}/assistant`)
  }

  const header = (
    <div className="shrink-0 border-b border-border/40 bg-canvas px-4 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-2xl border border-border/80 bg-surface-raised text-accent shadow-innerBorder">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="text-base font-semibold">Ella</div>
            <div className="text-xs text-muted-foreground">Assistente deste servidor</div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={expand} className="h-8 w-8 px-0" aria-label="Abrir Ella em página completa">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button ref={clearTriggerRef} variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={mutation || assistant.historyLoading || !assistant.messages.length} className="h-8 w-8 px-0" aria-label="Nova conversa">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button ref={closeButtonRef} variant="ghost" size="sm" onClick={close} className="h-8 w-8 px-0" aria-label="Fechar Ella">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {confirmClear && (
        <div role="group" aria-labelledby={confirmationTitleId} aria-describedby={confirmationDescriptionId} className="my-3 flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised px-3 py-2 text-sm">
          <span className="flex-1 text-muted-foreground">
            <span id={confirmationTitleId} className="sr-only">Encerrar conversa</span>
            <span id={confirmationDescriptionId}>Tem certeza que deseja encerrar esta conversa?</span>
          </span>
          <Button size="sm" onClick={clear} disabled={assistant.operation === 'clearing'} className="h-7 px-2 text-xs">Encerrar</Button>
          <Button ref={cancelClearRef} variant="ghost" size="sm" onClick={closeConfirmation} disabled={assistant.operation === 'clearing'} className="h-7 px-2 text-xs">Cancelar</Button>
        </div>
      )}
    </div>
  )

  const body = (
    <>
      <div ref={scrollContainerRef} data-testid="ella-drawer-conversation" className="flex-1 overflow-y-auto px-4 py-4">
        {assistant.historyLoading && <div className="space-y-4 py-4" aria-label="Carregando histórico"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-64" /></div>}
        {!assistant.historyLoading && assistant.historyError && <PanelAssistantError message={assistant.historyError} onRetry={assistant.reloadHistory} />}
        {!assistant.historyLoading && !assistant.historyError && !assistant.messages.length && <PanelAssistantEmptyState disabled={assistant.operation !== 'idle'} quickPrompts={QUICK_PROMPTS.map((label) => ({ label, onClick: () => assistant.send(label) }))} className="py-8" />}
        {assistant.messages.map((message) => <PanelAssistantMessage key={message.id} role={message.status === 'thinking' ? 'thinking' : message.status === 'error' ? 'error' : message.role} content={message.content} isError={message.status === 'error'} onRetry={message.status === 'error' ? () => assistant.retry(message.turnId) : undefined} retryDisabled={assistant.operation !== 'idle'} className="py-2" />)}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-border/40 bg-canvas px-4 py-3">
        <PanelAssistantComposer ref={composerRef} value={assistant.draft} onChange={assistant.setDraft} onSend={() => assistant.send()} disabled={assistant.operation !== 'idle' || !!assistant.historyError || !assistant.activeGuildId} loading={assistant.operation === 'sending' || assistant.operation === 'retrying'} />
        <div className="mt-1.5 px-1 text-[11px] text-muted-foreground/50">Enter para enviar · Shift+Enter para quebrar linha</div>
      </div>
    </>
  )

  const classes = 'flex flex-col overflow-hidden border border-border/80 bg-canvas shadow-floating'
  if (mobile) {
    return (
      <div data-testid="ella-drawer-portal" className="fixed inset-0 z-50 flex items-end">
        <div aria-hidden="true" className="absolute inset-0 cursor-default bg-black/60" onClick={() => !mutation && !confirmClear && close()} />
        <section ref={panelRef as React.RefObject<HTMLElement>} id={DRAWER_ID} role="dialog" aria-modal="true" aria-label="Assistente Ella" aria-hidden={commandPaletteOpen || undefined} inert={commandPaletteOpen} className={cn(classes, 'relative max-h-[92vh] w-full rounded-t-2xl')}>
          {header}
          {body}
        </section>
      </div>
    )
  }

  return (
    <aside ref={panelRef as React.RefObject<HTMLElement>} id={DRAWER_ID} role="complementary" aria-label="Assistente Ella" data-testid="ella-drawer-panel" aria-hidden={commandPaletteOpen || undefined} inert={commandPaletteOpen} className={cn(classes, 'fixed right-0 top-0 z-30 h-screen w-[460px] max-w-[min(100vw)] border-y-0 border-r-0')}>
      {header}
      {body}
    </aside>
  )
}
