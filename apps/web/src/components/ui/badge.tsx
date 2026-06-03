import * as React from 'react'

import { cn } from '../../lib/cn'

type badge_variant = 'neutral' | 'accent' | 'success' | 'agent' | 'info' | 'danger' | 'warning'

type badge_props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: badge_variant
}

const variants: Record<badge_variant, string> = {
  neutral: 'border-border/70 bg-chip text-muted-foreground',
  accent: 'border-accent/40 bg-accent/15 text-accent',
  success: 'border-success/35 bg-success/15 text-success',
  agent: 'border-agent/35 bg-agent/15 text-agent',
  info: 'border-info/35 bg-info/15 text-info',
  danger: 'border-danger/35 bg-danger/15 text-danger',
  warning: 'border-accent/35 bg-accent/15 text-accent',
}

export function Badge({ className, variant = 'neutral', ...props }: badge_props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
