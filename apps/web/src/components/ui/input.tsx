/**
 * Campo de entrada de texto reutilizável
 *
 * @param {Object} props - Props do componente
 * @param {string} [props.className] - Classes CSS adicionais
 * @param {string} [props.type='text'] - Tipo do input
 * @param {React.Ref<HTMLInputElement>} ref - Referência do input
 * @returns {JSX.Element} Input renderizado
 */
import * as React from 'react'

import { cn } from '../../lib/cn'

type input_props = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, input_props>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-border/80 bg-cursor-bg-input px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground transition-colors duration-[160ms] ease-cursor focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'
