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
        'relative inline-flex h-6 w-10 items-center rounded-full border border-border/80 bg-cursor-bg-input transition-colors duration-[160ms] ease-cursor',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        checked && 'bg-cursor-accent-soft border-accent',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 translate-x-1 rounded-full bg-muted-foreground transition-transform duration-[160ms] ease-cursor',
          checked && 'translate-x-5 bg-accent'
        )}
      />
    </button>
  )
}
