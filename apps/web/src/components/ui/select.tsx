import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'

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

type select_props = {
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
    const [search_query, setSearchQuery] = React.useState('')
    const [active_index, setActiveIndex] = React.useState<number>(-1)

    const filtered_options = React.useMemo(() => {
      if (!search_query) return options
      const q = search_query.toLowerCase()
      return options.filter((o) => {
        if (typeof o.label === 'string') return o.label.toLowerCase().includes(q)
        // Extract inner text if label is an array or object
        const labelStr = React.Children.toArray(o.label).reduce<string>((acc, child) => {
          if (typeof child === 'string') return acc + child
          if (typeof child === 'number') return acc + String(child)
          return acc
        }, '')
        if (labelStr) return labelStr.toLowerCase().includes(q)
        return String(o.value).toLowerCase().includes(q)
      })
    }, [options, search_query])

    const [menu_style, setMenuStyle] = React.useState<{
      left: number
      width: number
      top?: number
      bottom?: number
      maxHeight: number
    } | null>(null)

    const root_ref = React.useRef<HTMLDivElement | null>(null)
    const button_ref = React.useRef<HTMLButtonElement | null>(null)
    const menu_ref = React.useRef<HTMLDivElement | null>(null)

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
      setSearchQuery('')
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

      const update_position = () => {
        const button = button_ref.current
        if (!button) return

        const rect = button.getBoundingClientRect()
        const margin = 8
        const max_height = 288
        const viewport_height = window.innerHeight
        const viewport_width = window.innerWidth

        const space_below = viewport_height - rect.bottom - margin
        const space_above = rect.top - margin
        const should_open_above = space_below < 200 && space_above > space_below

        const width = rect.width
        const left = Math.min(Math.max(rect.left, margin), Math.max(margin, viewport_width - width - margin))

        if (should_open_above) {
          setMenuStyle({
            left,
            width,
            bottom: viewport_height - rect.top + margin,
            maxHeight: Math.min(max_height, Math.max(120, space_above)),
          })
        } else {
          setMenuStyle({
            left,
            width,
            top: rect.bottom + margin,
            maxHeight: Math.min(max_height, Math.max(120, space_below)),
          })
        }
      }

      update_position()

      window.addEventListener('resize', update_position)
      window.addEventListener('scroll', update_position, true)

      const onPointerDown = (event: MouseEvent) => {
        const target = event.target
        if (!(target instanceof Node)) return
        if (root_ref.current && root_ref.current.contains(target)) return
        if (menu_ref.current && menu_ref.current.contains(target)) return
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
        window.removeEventListener('resize', update_position)
        window.removeEventListener('scroll', update_position, true)
        document.removeEventListener('mousedown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    }, [open, close])

    const base =
      'flex h-11 w-full items-center justify-between rounded-xl border border-border/80 bg-surface/60 px-4 py-2 text-sm text-foreground shadow-sm backdrop-blur-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60'

    const menu =
      open && menu_style
        ? createPortal(
            <div
              ref={menu_ref}
              role="listbox"
              className="fixed z-9999 overflow-hidden rounded-xl border border-border/80 bg-surface/95 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md"
              style={{ left: menu_style.left, width: menu_style.width, top: menu_style.top, bottom: menu_style.bottom }}
            >
              {options.length > 5 && (
                <div className="p-2 border-b border-border/40">
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    className="w-full bg-surface/40 rounded-lg border border-border/50 px-3 py-1.5 text-sm outline-none focus:border-accent/50 transition-colors"
                    value={search_query}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Escape') {
                        close()
                        button_ref.current?.focus()
                      }
                    }}
                    autoFocus
                  />
                </div>
              )}
              <div className="overflow-auto py-1" style={{ maxHeight: menu_style.maxHeight }}>
                {filtered_options.length === 0 && (
                  <div className="py-3 text-center text-sm text-muted-foreground w-full">Nenhum resultado</div>
                )}
                {filtered_options.map((opt, idx) => {
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
                        'mx-1 flex w-[calc(100%-0.5rem)] items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                        'hover:bg-accent/15 disabled:pointer-events-none disabled:opacity-50',
                        is_active && 'bg-accent/12',
                        is_selected && 'bg-accent/20'
                      )}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (opt.disabled) return
                        commit_value(opt.value)
                        close()
                        button_ref.current?.focus()
                      }}
                    >
                      <span className="min-w-0 flex items-center gap-2 truncate">{opt.label}</span>
                      {is_selected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                    </button>
                  )
                })}
              </div>
            </div>,
            document.body
          )
        : null

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

        {menu}
      </div>
    )
  }
)

Select.displayName = 'Select'
