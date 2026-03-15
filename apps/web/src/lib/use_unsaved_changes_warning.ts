import { useEffect } from 'react'

type options = {
  enabled: boolean
  message?: string
}

export function use_unsaved_changes_warning({ enabled, message }: options) {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message ?? ''
      return message ?? ''
    }

    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [enabled, message])
}
