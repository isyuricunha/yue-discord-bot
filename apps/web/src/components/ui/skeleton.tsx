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
        'relative overflow-hidden rounded-md bg-cursor-bg-raised before:absolute before:inset-0 before:animate-shimmer before:bg-[linear-gradient(90deg,#202020_0%,#2b2b2b_50%,#202020_100%)] before:bg-[length:200%_100%]',
        className
      )}
      {...props}
    />
  )
}
