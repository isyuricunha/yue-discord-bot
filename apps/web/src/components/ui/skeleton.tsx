/**
 * Componente Skeleton para loading states
 *
 * @param {Object} props - Props do componente
 * @param {string} [props.className] - Classes CSS adicionais
 * @param {React.HTMLAttributes<HTMLDivElement>} props - Props nativos do div
 * @returns {JSX.Element} Skeleton renderizado
 */
import * as React from 'react'

import { cn } from '../../lib/cn'

type skeleton_props = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: skeleton_props) {
  return (
    <div
      className={cn(
        'cursor-skeleton relative overflow-hidden',
        className
      )}
      {...props}
    />
  )
}
