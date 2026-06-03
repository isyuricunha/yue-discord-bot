/**
 * Componente Tooltip para dicas de contexto
 *
 * @param {Object} props - Props do componente
 * @param {React.ReactNode} props.children - Elemento alvo
 * @param {string} props.content - Conteúdo da tooltip
 * @param {'top' | 'bottom' | 'left' | 'right'} [props.position='top'] - Posição da tooltip
 * @param {number} [props.delay=200] - Delay para exibição em ms
 * @returns {JSX.Element} Tooltip renderizada
 */
import * as React from 'react'
import { cn } from '../../lib/cn'

interface TooltipProps {
  children: React.ReactNode
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function Tooltip({
  children,
  content,
  position = 'top',
  delay = 200
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-white/10 border-b-transparent border-l-transparent border-r-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-white/10 border-t-transparent border-l-transparent border-r-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-white/10 border-r-transparent border-t-transparent border-b-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-white/10 border-l-transparent border-t-transparent border-b-transparent',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs',
            'bg-white/10 backdrop-blur-md border border-white/10',
            'text-foreground shadow-lg',
            'animate-in fade-in zoom-in-95 duration-150',
            positionClasses[position]
          )}
          role="tooltip"
        >
          {content}
          <span
            className={cn(
              'absolute w-0 h-0 border-4',
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  )
}

// Simpler version for inline use
export function TooltipInline({
  children,
  content
}: {
  children: React.ReactNode
  content: string
}) {
  return (
    <Tooltip content={content} position="top">
      {children}
    </Tooltip>
  )
}
