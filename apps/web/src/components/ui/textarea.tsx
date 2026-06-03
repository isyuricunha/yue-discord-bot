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
        'flex min-h-[92px] w-full resize-y rounded-xl border border-border/80 bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 shadow-innerBorder transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/60 disabled:cursor-not-allowed disabled:opacity-55',
        className
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
