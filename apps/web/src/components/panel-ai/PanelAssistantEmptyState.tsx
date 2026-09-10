import { Sparkles } from 'lucide-react'

import { cn } from '../../lib/cn'
import { Button } from '../ui/button'

type quick_prompt = {
  label: string
  onClick: () => void
}

type PanelAssistantEmptyStateProps = {
  guildName?: string
  quickPrompts: quick_prompt[]
  explainPrompts?: quick_prompt[]
  className?: string
  disabled?: boolean
}

export function PanelAssistantEmptyState({ guildName, quickPrompts, explainPrompts = [], className, disabled = false }: PanelAssistantEmptyStateProps) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center px-4 py-8', className)}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
        <Sparkles className="h-7 w-7" />
      </div>

      <div className="mb-2 text-lg font-semibold text-strong">
        {guildName ? `Olá, ${guildName}!` : 'Olá!'}
      </div>

      <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
        Tire dúvidas sobre recursos, configurações e o funcionamento deste servidor.
      </p>

      {quickPrompts.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {quickPrompts.map((prompt, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={prompt.onClick}
              disabled={disabled}
              className="rounded-full text-xs"
            >
              {prompt.label}
            </Button>
          ))}
        </div>
      )}

      {explainPrompts.length > 0 && (
        <div className="mt-4 w-full max-w-md">
          <div className="mb-2 text-center text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
            Explique uma configuração
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {explainPrompts.map((prompt, idx) => (
              <Button
                key={idx}
                variant="ghost"
                size="sm"
                onClick={prompt.onClick}
                disabled={disabled}
                className="rounded-full border-dashed text-xs"
              >
                {prompt.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
