import { cn } from '../../lib/cn'
import { Card, CardContent } from './card'
import { Button } from './button'

type error_state_props = {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function ErrorState({
  title = 'Algo deu errado',
  description,
  actionLabel = 'Tentar novamente',
  onAction,
  className,
}: error_state_props) {
  return (
    <Card className={className}>
      <CardContent className={cn('p-6 text-center space-y-3')}>
        <div className="text-base font-semibold">{title}</div>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
        {onAction && (
          <div className="pt-2">
            <Button variant="outline" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
