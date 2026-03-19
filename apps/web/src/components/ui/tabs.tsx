import { useId, type ReactNode } from 'react'
import clsx from 'clsx'

type tabs_item = {
  value: string
  label: string
  content: ReactNode
  disabled?: boolean
}

type tabs_props = {
  items: tabs_item[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function Tabs({ items, value, onValueChange, className }: tabs_props) {
  const base_id = useId()

  const active_item = items.find((i) => i.value === value)

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Tabs"
        className="inline-flex w-full items-center gap-1 rounded-2xl border border-border/80 bg-surface/40 p-1"
      >
        {items.map((item) => {
          const is_active = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`${base_id}-tab-${item.value}`}
              aria-controls={`${base_id}-panel-${item.value}`}
              aria-selected={is_active}
              tabIndex={is_active ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className={clsx(
                'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                item.disabled && 'cursor-not-allowed opacity-60',
                is_active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-surface/60 hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`${base_id}-panel-${value}`}
        aria-labelledby={`${base_id}-tab-${value}`}
        className="mt-6"
      >
        {active_item?.content}
      </div>
    </div>
  )
}
