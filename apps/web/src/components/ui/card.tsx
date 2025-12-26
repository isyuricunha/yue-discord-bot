import * as React from 'react'

import { cn } from '../../lib/cn'

type card_props = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: card_props) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-surface/50 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-md',
        className
      )}
      {...props}
    />
  )
}

type card_header_props = React.HTMLAttributes<HTMLDivElement>

export function CardHeader({ className, ...props }: card_header_props) {
  return <div className={cn('p-6', className)} {...props} />
}

type card_content_props = React.HTMLAttributes<HTMLDivElement>

export function CardContent({ className, ...props }: card_content_props) {
  return <div className={cn('px-6 pb-6', className)} {...props} />
}
