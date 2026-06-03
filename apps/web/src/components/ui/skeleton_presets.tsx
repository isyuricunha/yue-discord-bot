import type { CSSProperties } from 'react'

import { cn } from '../../lib/cn'
import { Card, CardContent } from './card'

interface SkeletonBaseProps {
  className?: string
  style?: CSSProperties
}

function SkeletonBase({ className, style }: SkeletonBaseProps) {
  return <div className={cn('cursor-skeleton', className)} style={style} />
}

function SkeletonText({ lines = 1 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase key={i} className={cn('h-4', i === lines - 1 && lines > 1 && 'w-3/4')} />
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <SkeletonText lines={3} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SkeletonBase className="h-20" />
          <SkeletonBase className="h-20" />
          <SkeletonBase className="h-20" />
        </div>
      </CardContent>
    </Card>
  )
}

export function SkeletonPageHeader() {
  return (
    <div className="mb-6">
      <SkeletonBase className="h-8 w-48" />
      <SkeletonBase className="mt-2 h-4 w-64" />
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
