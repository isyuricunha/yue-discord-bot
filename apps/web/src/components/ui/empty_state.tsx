import * as React from 'react'
import { cn } from '../../lib/cn'
import { Card, CardContent } from './card'
import { Button } from './button'

type empty_state_action = {
  label: string
  onClick: () => void
  variant?: 'solid' | 'outline'
}

type empty_state_props = {
  title: string
  description?: string
  icon?: React.ReactNode
  iconClassName?: string
  className?: string
  action?: empty_state_action
  secondaryAction?: empty_state_action
  compact?: boolean
}

export function EmptyState({
  title,
  description,
  icon,
  iconClassName,
  className,
  action,
  secondaryAction,
  compact = false
}: empty_state_props) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className={cn(
        'flex flex-col items-center text-center',
        compact ? 'p-6' : 'p-8'
      )}>
        {icon && (
          <div className={cn(
            'grid place-items-center rounded-full bg-surface/60',
            compact ? 'h-12 w-12 mb-3' : 'h-16 w-16 mb-4',
            iconClassName
          )}>
            {icon}
          </div>
        )}

        <div className={cn(
          'font-semibold',
          compact ? 'text-sm' : 'text-base'
        )}>
          {title}
        </div>

        {description && (
          <div className={cn(
            'text-muted-foreground',
            compact ? 'mt-1 text-xs' : 'mt-2 text-sm'
          )}>
            {description}
          </div>
        )}

        {(action || secondaryAction) && (
          <div className={cn(
            'flex items-center gap-2',
            compact ? 'mt-3' : 'mt-4'
          )}>
            {secondaryAction && (
              <Button
                variant="outline"
                size={compact ? 'sm' : 'md'}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )}
            {action && (
              <Button
                variant={action.variant || 'solid'}
                size={compact ? 'sm' : 'md'}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
