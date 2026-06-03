/**
 * Campo de texto de múltiplas linhas
 *
 * @param {Object} props - Props do componente
 * @param {string} [props.className] - Classes CSS adicionais
 * @param {React.Ref<HTMLTextAreaElement>} ref - Referência da textarea
 * @param {React.TextareaHTMLAttributes<HTMLTextAreaElement>} props - Props nativos da textarea
 * @returns {JSX.Element} Textarea renderizada
 */
import * as React from 'react'

import { cn } from '../../lib/cn'

type textarea_props = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, textarea_props>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full resize-y rounded-md border border-border/80 bg-cursor-bg-input px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground transition-colors duration-[160ms] ease-cursor focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
