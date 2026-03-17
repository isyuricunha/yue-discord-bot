import { useState, useCallback, useEffect, useRef } from 'react'

interface UseDirtyStateOptions {
  onBeforeUnload?: boolean
  confirmMessage?: string
}

export function useDirtyState<T extends Record<string, unknown>>(
  initialData: T,
  options: UseDirtyStateOptions = {}
) {
  const { onBeforeUnload = true, confirmMessage = 'Você tem alterações não salvas. Deseja sair?' } = options
  const [originalData, setOriginalData] = useState<T>(initialData)
  const [currentData, setCurrentData] = useState<T>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = JSON.stringify(originalData) !== JSON.stringify(currentData)

  // Update field
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setCurrentData(prev => ({ ...prev, [field]: value }))
  }, [])

  // Update multiple fields
  const updateFields = useCallback((fields: Partial<T>) => {
    setCurrentData(prev => ({ ...prev, ...fields }))
  }, [])

  // Reset to original
  const reset = useCallback(() => {
    setCurrentData(originalData)
  }, [originalData])

  // Mark as saved (update original)
  const markSaved = useCallback((newData?: T) => {
    const dataToSave = newData ?? currentData
    setOriginalData(dataToSave)
    setCurrentData(dataToSave)
    setIsSaving(false)
  }, [currentData])

  // Start saving state
  const startSaving = useCallback(() => {
    setIsSaving(true)
  }, [])

  // Auto-save with debounce
  const autoSave = useCallback((saveFn: () => Promise<void>, delay = 2000) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      if (isDirty) {
        startSaving()
        await saveFn()
        markSaved()
      }
    }, delay)
  }, [isDirty, startSaving, markSaved])

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Warn before unload if dirty
  useEffect(() => {
    if (!onBeforeUnload) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = confirmMessage
        return confirmMessage
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, onBeforeUnload, confirmMessage])

  return {
    data: currentData,
    originalData,
    isDirty,
    isSaving,
    updateField,
    updateFields,
    reset,
    markSaved,
    startSaving,
    autoSave,
  }
}

// Hook for simple form dirty state
export function useFormDirty(formData: Record<string, unknown>, originalData: Record<string, unknown>) {
  const isDirty = JSON.stringify(formData) !== JSON.stringify(originalData)
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = 'Você tem alterações não salvas.'
        return 'Você tem alterações não salvas.'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  return { isDirty }
}
