import { cn } from '../../lib/cn'
import { Card, CardContent } from './card'

// Base skeleton with pulse animation
interface SkeletonBaseProps {
  className?: string
  style?: React.CSSProperties
}

export function SkeletonBase({ 
  className,
  style
}: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-surface/60',
        className
      )}
      style={style}
    />
  )
}

// Text line skeleton
export function SkeletonText({ 
  lines = 1, 
  className,
  lastLineWidth = '75%'
}: { 
  lines?: number
  className?: string
  lastLineWidth?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 && lines > 1 && `w-[${lastLineWidth}]`
          )}
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  )
}

// Circle/Avatar skeleton
export function SkeletonCircle({ 
  size = 40 
}: { 
  size?: number 
}) {
  return (
    <SkeletonBase
      className="rounded-full"
      style={{ width: size, height: size }}
    />
  )
}

// Card skeleton
export function SkeletonCard({ 
  header = false,
  content = true,
  footer = false,
  className
}: {
  header?: boolean
  content?: boolean
  footer?: boolean
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {header && (
        <div className="border-b border-border/60 p-4">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={40} />
            <div className="flex-1">
              <SkeletonText lines={2} />
            </div>
          </div>
        </div>
      )}
      {content && (
        <CardContent className="p-4">
          <SkeletonText lines={3} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SkeletonBase className="h-20" />
            <SkeletonBase className="h-20" />
            <SkeletonBase className="h-20" />
          </div>
        </CardContent>
      )}
      {footer && (
        <div className="border-t border-border/60 p-4">
          <div className="flex items-center justify-end gap-2">
            <SkeletonBase className="h-9 w-24" />
            <SkeletonBase className="h-9 w-24" />
          </div>
        </div>
      )}
    </Card>
  )
}

// Stats card skeleton
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <SkeletonCircle size={36} />
              <div className="flex-1">
                <SkeletonBase className="h-3 w-16" />
                <SkeletonBase className="mt-1 h-5 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Table skeleton
export function SkeletonTable({ 
  rows = 5, 
  columns = 4 
}: { 
  rows?: number
  columns?: number
}) {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-border/60 bg-surface/30 p-3">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBase 
            key={i} 
            className={cn('h-4', i === 0 ? 'flex-1' : 'w-24 ml-4')} 
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div 
          key={rowIdx} 
          className={cn(
            'flex p-3',
            rowIdx !== rows - 1 && 'border-b border-border/60'
          )}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonBase 
              key={colIdx} 
              className={cn('h-4', colIdx === 0 ? 'flex-1' : 'w-24 ml-4')} 
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// List skeleton
export function SkeletonList({ 
  items = 5,
  avatar = true,
  lines = 2
}: { 
  items?: number
  avatar?: boolean
  lines?: number
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-3 p-3">
            {avatar && <SkeletonCircle size={40} />}
            <div className="flex-1">
              <SkeletonText lines={lines} />
            </div>
            <SkeletonBase className="h-8 w-8 rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Form skeleton
export function SkeletonForm({ 
  fields = 4,
  hasHeader = true
}: { 
  fields?: number
  hasHeader?: boolean
}) {
  return (
    <div className="space-y-4">
      {hasHeader && (
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <SkeletonCircle size={48} />
          <div className="flex-1">
            <SkeletonBase className="h-5 w-48" />
            <SkeletonBase className="mt-1 h-3 w-32" />
          </div>
        </div>
      )}
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <SkeletonBase className="mb-2 h-3 w-24" />
            <SkeletonBase className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <SkeletonBase className="h-10 w-24" />
        <SkeletonBase className="h-10 w-32" />
      </div>
    </div>
  )
}

// Page header skeleton
export function SkeletonPageHeader() {
  return (
    <div className="mb-6">
      <SkeletonBase className="h-8 w-48" />
      <SkeletonBase className="mt-2 h-4 w-64" />
    </div>
  )
}

// Full page skeleton for guild pages
export function SkeletonGuildPage() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      
      {/* Guild header card */}
      <SkeletonCard header />
      
      {/* Stats */}
      <SkeletonStats count={4} />
      
      {/* Content sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonCard content />
        </div>
        <div>
          <SkeletonCard content />
        </div>
      </div>
    </div>
  )
}

// Dashboard skeleton
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} content />
        ))}
      </div>
    </div>
  )
}
