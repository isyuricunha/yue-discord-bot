/**
 * Botão reutilizável com suporte a loading state e variantes
 *
 * @param {Object} props - Props do componente
 * @param {string} [props.variant='solid'] - Variante visual (solid, outline, ghost)
 * @param {string} [props.size='md'] - Tamanho do botão (sm, md, lg)
 * @param {boolean} [props.isLoading=false] - Estado de carregamento
 * @param {boolean} [props.disabled=false] - Estado desabilitado
 * @param {React.ReactNode} props.children - Conteúdo do botão
 * @param {React.Ref<HTMLButtonElement>} ref - Referência do botão
 * @returns {JSX.Element} Botão renderizado
 */
import * as React from 'react'

import { cn } from '../../lib/cn'

type button_variant = 'solid' | 'outline' | 'ghost'

type button_size = 'sm' | 'md' | 'lg'

type button_props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: button_variant
  size?: button_size
  isLoading?: boolean
}

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-colors duration-[160ms] ease-cursor text-center leading-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-60'

const variants: Record<button_variant, string> = {
  solid:
    'border-transparent bg-accent text-white hover:bg-cursor-accent-hover active:bg-cursor-accent-active',
  outline:
    'border-border/80 bg-transparent text-foreground hover:border-border hover:bg-cursor-bg-hover',
  ghost: 'border-transparent bg-transparent text-foreground hover:bg-cursor-bg-hover',
}

const sizes: Record<button_size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-10 px-5 text-sm',
}

export const Button = React.forwardRef<HTMLButtonElement, button_props>(
  ({ className, variant = 'solid', size = 'md', isLoading = false, disabled, children, 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          isLoading && 'cursor-wait',
          className
        )}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        aria-label={ariaLabel || (typeof children === 'string' ? children : 'Botão')}
        tabIndex={disabled || isLoading ? -1 : 0}
        {...props}
      >
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                'h-5 w-5 animate-spin rounded-full border-[2.5px]',
                variant === 'solid'
                  ? 'border-white/20 border-t-white'
                  : 'border-foreground/20 border-t-accent'
              )}
            />
          </span>
        )}
        <span className={cn('inline-flex items-center justify-center leading-none transition-opacity duration-200', isLoading && 'opacity-0')}>
          {children}
        </span>
      </button>
    )
  }
)

Button.displayName = 'Button'
