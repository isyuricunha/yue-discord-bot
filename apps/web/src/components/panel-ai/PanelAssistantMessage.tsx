import { Copy, ExternalLink, Highlighter, ListTree, Save, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import * as React from 'react'
import type { panel_ai_action, panel_ai_apply_proposal, panel_ai_sensitive_request } from '@yuebot/shared'

import { cn } from '../../lib/cn'
import { queryClient } from '../../lib/query-client'
import { toast_error, toast_success } from '../../store/toast'
import { Button } from '../ui/button'
import { PanelAssistantMarkdown } from './PanelAssistantMarkdown'
import { apply_panel_ai_prefill_action } from './prefill'
import { resolvePanelAiPageContext } from './resolvePageKey'
import {
  can_apply_panel_ai_action,
  confirm_panel_ai_server_apply,
  prepare_panel_ai_server_apply,
} from './server_apply'

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

type prefill_action = Extract<panel_ai_action, { type: 'prefill_form' }>

type active_server_proposal = {
  action: prefill_action
  proposal: panel_ai_apply_proposal
}

function ActionIcon({ action }: { action: panel_ai_action }) {
  if (action.type === 'navigate') return <ExternalLink className="h-3.5 w-3.5" />
  if (action.type === 'open_section') return <ListTree className="h-3.5 w-3.5" />
  if (action.type === 'prefill_form') return <WandSparkles className="h-3.5 w-3.5" />
  return <Highlighter className="h-3.5 w-3.5" />
}

function current_guild_id() {
  const match = /^\/guild\/([^/]+)/.exec(window.location.pathname)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

function display_apply_value(value: string | number | boolean) {
  if (value === true) return 'Ativado'
  if (value === false) return 'Desativado'
  return String(value)
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function wait_for_page(pageKey: prefill_action['pageKey'], attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (resolvePanelAiPageContext(window.location.pathname)?.pageKey === pageKey) return true
    await delay(50)
  }
  return false
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
  const [prefillingActionId, setPrefillingActionId] = React.useState<string | null>(null)
  const [preparingServerActionId, setPreparingServerActionId] = React.useState<string | null>(null)
  const [confirmingProposalId, setConfirmingProposalId] = React.useState<string | null>(null)
  const [serverProposal, setServerProposal] = React.useState<active_server_proposal | null>(null)
  const [appliedActionIds, setAppliedActionIds] = React.useState<Set<string>>(() => new Set())

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast_success('Resposta copiada.', 'Ella')
    } catch {
      toast_error('Não foi possível copiar. Tente selecionar o texto manualmente.', 'Ella')
    }
  }, [content])

  const handleAction = React.useCallback(async (action: panel_ai_action) => {
    if (action.type !== 'prefill_form') {
      onAction?.(action)
      return
    }

    if (prefillingActionId) return
    setPrefillingActionId(action.id)
    try {
      let currentPageKey = resolvePanelAiPageContext(window.location.pathname)?.pageKey ?? null
      if (currentPageKey !== action.pageKey) {
        onAction?.(action)
        const reachedPage = await wait_for_page(action.pageKey)
        if (!reachedPage) {
          toast_error('Não foi possível abrir a página necessária para preparar a alteração.', 'Ella')
          return
        }
        currentPageKey = action.pageKey
      }

      const result = await apply_panel_ai_prefill_action(action, currentPageKey)

      if (result.applied === action.changes.length) {
        toast_success(
          action.changes.length === 1
            ? 'Alteração preparada. Revise e clique em Salvar se estiver tudo certo.'
            : `${action.changes.length} alterações preparadas. Revise e clique em Salvar se estiver tudo certo.`,
          'Ella',
        )
        return
      }

      if (result.applied > 0) {
        toast_error(
          `${result.applied} alteração(ões) foram preparadas, mas ${result.failed} campo(s) não estavam disponíveis. Revise o formulário antes de salvar.`,
          'Ella',
        )
        return
      }

      toast_error('Não foi possível preparar esses campos no formulário atual.', 'Ella')
    } finally {
      setPrefillingActionId(null)
    }
  }, [onAction, prefillingActionId])

  const prepareServerApply = React.useCallback(async (action: prefill_action) => {
    if (preparingServerActionId || confirmingProposalId) return
    const guildId = current_guild_id()
    if (!guildId) {
      toast_error('Não foi possível identificar o servidor atual.', 'Ella')
      return
    }

    setPreparingServerActionId(action.id)
    try {
      const result = await prepare_panel_ai_server_apply(guildId, action)
      if (!result.ok) {
        toast_error('Não foi possível preparar o diff no servidor. Tente novamente.', 'Ella')
        return
      }
      if (result.noop) {
        toast_success('Esses valores já estão aplicados no servidor.', 'Ella')
        setAppliedActionIds((current) => new Set(current).add(action.id))
        return
      }
      setServerProposal({ action, proposal: result.proposal })
    } finally {
      setPreparingServerActionId(null)
    }
  }, [confirmingProposalId, preparingServerActionId])

  const confirmServerApply = React.useCallback(async () => {
    if (!serverProposal || confirmingProposalId) return
    const guildId = current_guild_id()
    if (!guildId) {
      setServerProposal(null)
      toast_error('Não foi possível identificar o servidor atual.', 'Ella')
      return
    }

    const { action, proposal } = serverProposal
    setConfirmingProposalId(proposal.id)
    try {
      const result = await confirm_panel_ai_server_apply(guildId, proposal.id)
      if (!result.ok) {
        if (result.status === 409) {
          setServerProposal(null)
          toast_error('A configuração mudou desde a proposta. Peça à Ella para revisar novamente.', 'Ella')
          return
        }
        if (result.status === 404) {
          setServerProposal(null)
          toast_error('Essa proposta expirou. Peça uma nova alteração à Ella.', 'Ella')
          return
        }
        toast_error('Não foi possível aplicar as alterações no servidor.', 'Ella')
        return
      }

      const currentPageKey = resolvePanelAiPageContext(window.location.pathname)?.pageKey ?? null
      setAppliedActionIds((current) => new Set(current).add(action.id))
      setServerProposal(null)
      toast_success(
        result.result.changes.length === 1
          ? 'Alteração aplicada e salva no servidor.'
          : `${result.result.changes.length} alterações aplicadas e salvas no servidor.`,
        'Ella',
      )

      await queryClient.invalidateQueries()
      if (currentPageKey === action.pageKey) {
        void apply_panel_ai_prefill_action(action, currentPageKey).catch(() => undefined)
      }
    } finally {
      setConfirmingProposalId(null)
    }
  }, [confirmingProposalId, serverProposal])

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
            {actions.flatMap((action) => {
              const buttons = [
                <Button
                  key={`${action.id}-default`}
                  variant="outline"
                  size="sm"
                  onClick={() => void handleAction(action)}
                  disabled={prefillingActionId === action.id}
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  aria-label={action.label}
                >
                  <ActionIcon action={action} />
                  {action.label}
                </Button>,
              ]

              if (can_apply_panel_ai_action(action)) {
                const applied = appliedActionIds.has(action.id)
                buttons.push(
                  <Button
                    key={`${action.id}-server`}
                    variant="outline"
                    size="sm"
                    onClick={() => void prepareServerApply(action)}
                    disabled={applied || preparingServerActionId === action.id || confirmingProposalId !== null}
                    className="h-8 gap-1.5 px-2.5 text-xs"
                    aria-label={applied ? 'Aplicado' : 'Aplicar no servidor'}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {applied ? 'Aplicado' : 'Aplicar no servidor'}
                  </Button>,
                )
              }
              return buttons
            })}
          </div>
        )}

        {serverProposal && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3" role="group" aria-label="Confirmação de alterações da Ella">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Confirmar alterações no servidor</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Este diff foi recalculado no servidor. Confirmar irá persistir exatamente os campos abaixo.
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {serverProposal.proposal.changes.map((change) => (
                <div key={change.target} className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2 text-xs">
                  <div className="font-medium text-foreground">{change.targetLabel}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span className="line-through">{display_apply_value(change.before)}</span>
                    <span aria-hidden="true">→</span>
                    <span className="font-semibold text-foreground">{display_apply_value(change.after)}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs font-medium text-foreground">
              Nada será salvo até você clicar em Confirmar. A proposta expira em poucos minutos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void confirmServerApply()}
                disabled={confirmingProposalId === serverProposal.proposal.id}
                className="h-8 px-3 text-xs"
                aria-label="Confirmar e salvar"
              >
                Confirmar e salvar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setServerProposal(null)}
                disabled={confirmingProposalId === serverProposal.proposal.id}
                className="h-8 px-3 text-xs"
                aria-label="Cancelar"
              >
                Cancelar
              </Button>
            </div>
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