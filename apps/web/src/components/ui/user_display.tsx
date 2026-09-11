import * as React from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '../../lib/cn'

type user_display_props = {
  userId: string
  username?: string | null
  className?: string
}

/**
 * Shows a Discord user as "username" with a click-to-copy button for the
 * raw user ID. When the username is unknown (user left the server), the
 * raw ID becomes the primary text with a "(saiu)" indicator.
 */
export function UserDisplay({ userId, username, className }: user_display_props) {
  const [copied, set_copied] = React.useState(false)
  const resolved = Boolean(username)
  const display_name = username || userId

  const copy_id = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userId)
      set_copied(true)
      window.setTimeout(() => set_copied(false), 1500)
    } catch {
      // clipboard unavailable; nothing to do
    }
  }, [userId])

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <span className={cn('min-w-0 truncate font-medium', !resolved && 'font-mono text-xs')}>
        {display_name}
      </span>
      {!resolved && <span className="shrink-0 text-[10px] text-muted-foreground/70">(saiu)</span>}
      <button
        type="button"
        onClick={() => void copy_id()}
        className="text-muted-foreground/40 hover:text-foreground inline-flex shrink-0 transition-colors"
        aria-label={`Copiar ID de ${display_name}`}
        title={`Copiar ID: ${userId}`}
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
    </span>
  )
}
