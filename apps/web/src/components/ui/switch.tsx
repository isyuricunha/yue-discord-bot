/**
 * Componente Switch para toggles
 *
 * @param {Object} props - Props do componente
 * @param {boolean} props.checked - Estado do switch
 * @param {function} props.onCheckedChange - Callback quando estado muda
 * @param {boolean} [props.disabled=false] - Desabilitado
 * @param {string} [props.className] - Classes CSS adicionais
 * @param {string} [props.label] - Rótulo acessível
 * @returns {JSX.Element} Switch renderizado
 */
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
        'relative inline-flex h-11 w-11 lg:h-6 lg:w-11 items-center rounded-full border border-border/80 bg-input transition-colors duration-150 shadow-innerBorder',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
        checked && 'border-success/40 bg-success/20',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 translate-x-[3px] rounded-full bg-muted-foreground shadow-sm transition-transform duration-150 lg:h-[18px] lg:w-[18px] lg:translate-x-1',
          checked && 'translate-x-[23px] bg-success shadow-[var(--cursor-green-glow)] lg:translate-x-[22px]'
        )}
      />
    </button>
  )
}
