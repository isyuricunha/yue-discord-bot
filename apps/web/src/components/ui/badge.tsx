import * as React from 'react'

import { cn } from '../../lib/cn'

type badge_variant = 'neutral' | 'accent'

type badge_props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: badge_variant
}

const variants: Record<badge_variant, string> = {
  neutral: 'border-border/70 bg-surface/60 text-muted-foreground',
  accent: 'border-accent/40 bg-accent/15 text-accent',
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
