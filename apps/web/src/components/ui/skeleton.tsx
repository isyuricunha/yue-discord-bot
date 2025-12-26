import * as React from 'react'

import { cn } from '../../lib/cn'

type skeleton_props = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: skeleton_props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-surface/70 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        className
      )}
      {...props}
    />
  )
}
