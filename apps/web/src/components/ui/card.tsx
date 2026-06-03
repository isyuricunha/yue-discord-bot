/**
 * Componente Card para exibição de conteúdo em cards
 *
 * @param {Object} props - Props do componente
 * @param {string} [props.className] - Classes CSS adicionais
 * @param {React.HTMLAttributes<HTMLDivElement>} props - Props nativos do div
 * @returns {JSX.Element} Card renderizado
 */
import * as React from 'react'

import { cn } from '../../lib/cn'

type card_props = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: card_props) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-surface',
        className
      )}
      {...props}
    />
  )
}

type card_header_props = React.HTMLAttributes<HTMLDivElement>

export function CardHeader({ className, ...props }: card_header_props) {
  return <div className={cn('p-5', className)} {...props} />
}

type card_content_props = React.HTMLAttributes<HTMLDivElement>

export function CardContent({ className, ...props }: card_content_props) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}
