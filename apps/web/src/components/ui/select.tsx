import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '../../lib/cn'

type option_data = {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

function extract_options(children: React.ReactNode) {
  const nodes = React.Children.toArray(children)
  const options: option_data[] = []

  for (const node of nodes) {
    if (!React.isValidElement(node)) continue
    if (node.type !== 'option') continue

    const props = node.props as React.OptionHTMLAttributes<HTMLOptionElement> & {
      children?: React.ReactNode
    }

    options.push({
      value: String(props.value ?? ''),
      label: props.children,
      disabled: Boolean(props.disabled),
    })
  }

  return options
}

export type select_props = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  children?: React.ReactNode
  name?: string
  id?: string
  'aria-label'?: string
}

export const Select = React.forwardRef<HTMLButtonElement, select_props>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onValueChange,
      disabled,
      placeholder,
      name,
      id,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const options = React.useMemo(() => extract_options(children), [children])
    const is_controlled = typeof value === 'string'

    const [uncontrolled_value, setUncontrolledValue] = React.useState(defaultValue ?? '')
    const current_value = is_controlled ? value : uncontrolled_value

    const [open, setOpen] = React.useState(false)
    const [active_index, setActiveIndex] = React.useState<number>(-1)

    const root_ref = React.useRef<HTMLDivElement | null>(null)
    const button_ref = React.useRef<HTMLButtonElement | null>(null)

    const resolved_button_ref = React.useCallback(
      (node: HTMLButtonElement | null) => {
        button_ref.current = node

        if (!ref) return
        if (typeof ref === 'function') ref(node)
        else ref.current = node
      },
      [ref]
    )

    const selected = React.useMemo(
      () => options.find((o) => o.value === (current_value ?? '')),
      [options, current_value]
    )

    const label = selected?.label ?? placeholder ?? options[0]?.label ?? 'Selecionar'

    const close = React.useCallback(() => {
      setOpen(false)
      setActiveIndex(-1)
    }, [])

    const commit_value = React.useCallback(
      (next: string) => {
        if (!is_controlled) setUncontrolledValue(next)
        onValueChange?.(next)
      },
      [is_controlled, onValueChange]
    )

    React.useEffect(() => {
      if (!open) return

      const onPointerDown = (event: MouseEvent) => {
        if (!root_ref.current) return
        if (event.target instanceof Node && root_ref.current.contains(event.target)) return
        close()
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
          button_ref.current?.focus()
        }
      }

      document.addEventListener('mousedown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)

      return () => {
        document.removeEventListener('mousedown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    }, [open, close])

    const base =
      'flex h-11 w-full items-center justify-between rounded-xl border border-border/80 bg-surface/60 px-4 py-2 text-sm text-foreground shadow-sm backdrop-blur-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60'

    return (
      <div ref={root_ref} className="relative">
        <input type="hidden" name={name} value={current_value ?? ''} />

        <button
          id={id}
          ref={resolved_button_ref}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(base, className)}
          onClick={() => {
            if (disabled) return
            setOpen((prev) => !prev)
          }}
          onKeyDown={(e) => {
            if (disabled) return

            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
              const idx = options.findIndex((o) => !o.disabled)
              setActiveIndex(idx)
            }
          }}
        >
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border/80 bg-surface/95 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md"
          >
            <div className="max-h-72 overflow-auto py-1">
              {options.map((opt, idx) => {
                const is_selected = opt.value === (current_value ?? '')
                const is_active = idx === active_index

                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={is_selected}
                    disabled={opt.disabled}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors',
                      'hover:bg-surface/70 disabled:cursor-not-allowed disabled:opacity-50',
                      is_active && 'bg-surface/70',
                      is_selected && 'text-foreground'
                    )}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      if (opt.disabled) return
                      commit_value(opt.value)
                      close()
                      button_ref.current?.focus()
                    }}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {is_selected && <Check className="h-4 w-4 text-accent" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
