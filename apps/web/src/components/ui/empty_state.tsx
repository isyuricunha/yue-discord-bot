import { cn } from '../../lib/cn'
import { Card, CardContent } from './card'

type empty_state_props = {
  title: string
  description?: string
  className?: string
}

export function EmptyState({ title, description, className }: empty_state_props) {
  return (
    <Card className={className}>
      <CardContent className={cn('p-6 text-center')}
      >
        <div className="text-base font-semibold">{title}</div>
        {description && <div className="mt-2 text-sm text-muted-foreground">{description}</div>}
      </CardContent>
    </Card>
  )
}
