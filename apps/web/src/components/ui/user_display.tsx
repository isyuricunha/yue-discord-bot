import * as React from 'react'
import { cn } from '../../lib/cn'

type user_display_props = {
  userId: string
  username?: string | null
  className?: string
  compact?: boolean
}

export function UserDisplay({ userId, username, className, compact = false }: user_display_props) {
  const [copied, setCopied] = React.useState(false)
  const display_name = username || userId
  const is_resolved = Boolean(username)

  const copy_id = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable; fail silently
    }
  }, [userId])

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span className="min-w-0 truncate">{display_name}</span>
      {!is_resolved && <span className="text-muted-foreground/50 shrink-0 text-[10px]">(saiu)</span>}
      <button
        type="button"
        onClick={() => void copy_id()}
        className="text-muted-foreground/50 hover:text-foreground shrink-0 transition-colors"
        aria-label={`Copiar ID de ${display_name}`}
        tabIndex={-1}
      >
        {copied ? (
          <span className="text-[10px]">copiado!</span>
        ) : (
          <span className="font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-60">
            {userId.slice(0, 8)}
          </span>
        )}
      </button>
      {!compact && null}
    </span>
  )
}
