import * as React from 'react'

import { cn } from '../../lib/cn'

type button_variant = 'solid' | 'outline' | 'ghost'

type button_size = 'sm' | 'md' | 'lg'

export type button_props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: button_variant
  size?: button_size
  isLoading?: boolean
}

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-60'

const variants: Record<button_variant, string> = {
  solid:
    'bg-accent text-black shadow-[0_0_0_1px_rgba(255,106,0,0.35),0_10px_30px_rgba(255,106,0,0.12)] hover:bg-accent/90 active:bg-accent/85',
  outline:
    'bg-transparent text-foreground border border-border/80 hover:border-accent/60 hover:bg-surface/60',
  ghost: 'bg-transparent text-foreground hover:bg-surface/70',
}

const sizes: Record<button_size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export const Button = React.forwardRef<HTMLButtonElement, button_props>(
  ({ className, variant = 'solid', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span
              className={cn(
                'h-4 w-4 animate-spin rounded-full border-2',
                variant === 'solid' ? 'border-black/30 border-t-black' : 'border-foreground/25 border-t-foreground'
              )}
            />
            <span>Carregando</span>
          </span>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
