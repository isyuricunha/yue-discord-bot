import * as React from 'react'

import { cn } from '../../lib/cn'

type textarea_props = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, textarea_props>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full resize-y rounded-xl border border-border/80 bg-surface/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 shadow-sm backdrop-blur-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
