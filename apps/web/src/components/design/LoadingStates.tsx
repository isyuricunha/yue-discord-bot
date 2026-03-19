import React from 'react'
import { cn } from '../../lib/cn'
import { TRANSITIONS } from './tokens'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeClasses[size],
        className
      )}
      style={{
        animationDuration: TRANSITIONS.durations.normal,
      }}
      role="status"
      aria-label="Carregando"
    >
      <span className="sr-only">Carregando</span>
    </div>
  )
}

interface LoadingCardProps {
  title?: string
  description?: string
  lines?: number
  className?: string
}

export function LoadingCard({ title, description, lines = 3, className }: LoadingCardProps) {
  return (
    <div className={cn('rounded-xl border border-border/80 bg-background/95 backdrop-blur-sm p-6', className)}>
      {title && (
        <div className="mb-4">
          <div className="h-6 w-32 bg-muted/20 rounded-md animate-pulse" />
        </div>
      )}
      
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="flex items-center space-x-3">
            <LoadingSpinner size="sm" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted/20 rounded-md animate-pulse" />
              {index === 0 && description && (
                <div className="h-3 bg-muted/10 rounded-md animate-pulse w-3/4" />
              )}
            </div>
          </div>
        ))}
      </div>
      
      {description && (
        <div className="mt-4 text-center text-sm text-muted-foreground animate-pulse">
          {description}
        </div>
      )}
    </div>
  )
}

interface LoadingTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function LoadingTable({ rows = 5, columns = 4, className }: LoadingTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/80 bg-background/95', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="h-12 px-4 text-left">
                  <div className="h-4 bg-muted/20 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/30">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="h-12 px-4">
                    <div className="h-4 bg-muted/10 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface LoadingPageProps {
  title?: string
  description?: string
  children?: React.ReactNode
}

export function LoadingPage({ title = "Carregando", description, children }: LoadingPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4 text-center">
        <LoadingSpinner size="lg" />
        
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight animate-pulse">
            {title}
          </h1>
          
          {description && (
            <p className="text-muted-foreground animate-pulse">
              {description}
            </p>
          )}
          
          {children && (
            <div className="mt-4">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Skeleton components for specific use cases
interface SkeletonLineProps {
  width?: string
  className?: string
}

export function SkeletonLine({ width = 'w-full', className }: SkeletonLineProps) {
  return (
    <div className={cn('h-4 bg-muted/20 rounded-md animate-pulse', width, className)} />
  )
}

interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  return (
    <div className={cn('rounded-full bg-muted/20 animate-pulse', sizeClasses[size], className)} />
  )
}

interface SkeletonTextProps {
  lines?: number
  className?: string
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="space-y-1">
          <div className="h-4 bg-muted/20 rounded-md animate-pulse" />
          <div className="h-3 bg-muted/10 rounded-md animate-pulse w-3/4" />
        </div>
      ))}
    </div>
  )
}
