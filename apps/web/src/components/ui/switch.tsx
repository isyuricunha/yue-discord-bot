import { cn } from '../../lib/cn'

export type switch_props = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  label?: string
}

export function Switch({ checked, onCheckedChange, disabled = false, className, label }: switch_props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 items-center rounded-full border border-border/80 bg-surface/70 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        checked && 'bg-accent/20 border-accent/40',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 translate-x-1 rounded-full bg-foreground/90 shadow-sm transition-transform',
          checked && 'translate-x-6 bg-accent shadow-[0_0_18px_rgba(255,106,0,0.35)]'
        )}
      />
    </button>
  )
}
