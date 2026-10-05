import { cn } from '../../lib/cn'

/**
 * YuTheme v2 dot matrix loader: 3x3 ring sweep for thinking/working rows.
 * Neutral by default; `agent` switches to the AI-state variant. The 9 spans
 * are empty and aria-hidden; the wrapper announces `label` as a status.
 */
export function DotMatrix({
  className,
  agent = false,
  label = 'Pensando',
}: {
  className?: string
  agent?: boolean
  label?: string
}) {
  return (
    <span
      className={cn('yu-dot-matrix', agent && 'yu-dot-matrix--agent', className)}
      role="status"
      aria-label={label}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} aria-hidden="true" />
      ))}
    </span>
  )
}