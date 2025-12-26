import * as React from 'react'

import { cn } from '../../lib/cn'

export type input_props = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, input_props>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-xl border border-border/80 bg-surface/60 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 shadow-sm backdrop-blur-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'
