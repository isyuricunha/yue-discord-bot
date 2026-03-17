import { useState, useCallback, useRef } from 'react'
import { toast_error, toast_success } from '../store/toast'

type ValidationRule<T> = {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: T[keyof T], values: T) => boolean | string
  message?: string
}

type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T>[] | ValidationRule<T>
}

type FormErrors<T> = {
  [K in keyof T]?: string
}

interface UseFormOptions<T> {
  initialValues: T
  validationSchema?: ValidationSchema<T>
  onSubmit: (values: T) => Promise<void>
  onSuccess?: () => void
  successMessage?: string
  errorMessage?: string
  resetOnSuccess?: boolean
}

interface UseFormReturn<T> {
  values: T
  errors: FormErrors<T>
  touched: { [K in keyof T]?: boolean }
  isSubmitting: boolean
  isDirty: boolean
  setValue: <K extends keyof T>(field: K, value: T[K]) => void
  setValues: (values: Partial<T>) => void
  setTouched: (field: keyof T) => void
  validateField: (field: keyof T) => boolean
  validateForm: () => boolean
  handleSubmit: (e?: React.FormEvent) => Promise<void>
  reset: () => void
  clearErrors: () => void
}

export function useForm<T extends Record<string, unknown>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const {
    initialValues,
    validationSchema,
    onSubmit,
    onSuccess,
    successMessage,
    errorMessage = 'Erro ao salvar. Tente novamente.',
    resetOnSuccess = false,
  } = options

  const [values, setValuesState] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors<T>>({})
  const [touched, setTouchedState] = useState<{ [K in keyof T]?: boolean }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const initialValuesRef = useRef(initialValues)

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValuesRef.current)

  const validateField = useCallback(
    (field: keyof T): boolean => {
      if (!validationSchema) return true

      const rules = validationSchema[field]
      if (!rules) return true

      const value = values[field]
      const ruleArray = Array.isArray(rules) ? rules : [rules]

      for (const rule of ruleArray) {
        // Required check
        if (rule.required && (value === undefined || value === null || value === '')) {
          setErrors((prev) => ({ ...prev, [field]: rule.message || 'Campo obrigatório' }))
          return false
        }

        // Skip other validations if empty and not required
        if (!value && !rule.required) continue

        // String validations
        if (typeof value === 'string') {
          if (rule.minLength && value.length < rule.minLength) {
            setErrors((prev) => ({
              ...prev,
              [field]: rule.message || `Mínimo de ${rule.minLength} caracteres`,
            }))
            return false
          }

          if (rule.maxLength && value.length > rule.maxLength) {
            setErrors((prev) => ({
              ...prev,
              [field]: rule.message || `Máximo de ${rule.maxLength} caracteres`,
            }))
            return false
          }

          if (rule.pattern && !rule.pattern.test(value)) {
            setErrors((prev) => ({ ...prev, [field]: rule.message || 'Formato inválido' }))
            return false
          }
        }

        // Number validations
        if (typeof value === 'number') {
          if (rule.min !== undefined && value < rule.min) {
            setErrors((prev) => ({
              ...prev,
              [field]: rule.message || `Valor mínimo: ${rule.min}`,
            }))
            return false
          }

          if (rule.max !== undefined && value > rule.max) {
            setErrors((prev) => ({
              ...prev,
              [field]: rule.message || `Valor máximo: ${rule.max}`,
            }))
            return false
          }
        }

        // Custom validation
        if (rule.custom) {
          const result = rule.custom(value, values)
          if (result !== true) {
            setErrors((prev) => ({ ...prev, [field]: typeof result === 'string' ? result : rule.message || 'Valor inválido' }))
            return false
          }
        }
      }

      // Clear error if validation passes
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
      return true
    },
    [values, validationSchema]
  )

  const validateForm = useCallback((): boolean => {
    if (!validationSchema) return true

    let isValid = true
    const newErrors: FormErrors<T> = {}

    for (const field of Object.keys(validationSchema) as Array<keyof T>) {
      const rules = validationSchema[field]
      if (!rules) continue

      const value = values[field]
      const ruleArray = Array.isArray(rules) ? rules : [rules]

      for (const rule of ruleArray) {
        let fieldError: string | null = null

        if (rule.required && (value === undefined || value === null || value === '')) {
          fieldError = rule.message || 'Campo obrigatório'
        } else if (typeof value === 'string') {
          if (rule.minLength && value.length < rule.minLength) {
            fieldError = rule.message || `Mínimo de ${rule.minLength} caracteres`
          } else if (rule.maxLength && value.length > rule.maxLength) {
            fieldError = rule.message || `Máximo de ${rule.maxLength} caracteres`
          } else if (rule.pattern && !rule.pattern.test(value)) {
            fieldError = rule.message || 'Formato inválido'
          }
        } else if (typeof value === 'number') {
          if (rule.min !== undefined && value < rule.min) {
            fieldError = rule.message || `Valor mínimo: ${rule.min}`
          } else if (rule.max !== undefined && value > rule.max) {
            fieldError = rule.message || `Valor máximo: ${rule.max}`
          }
        }

        if (fieldError) {
          newErrors[field] = fieldError
          isValid = false
          break
        }
      }
    }

    setErrors(newErrors)
    return isValid
  }, [values, validationSchema])

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }))
    // Clear error when field changes
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }, [errors])

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }))
  }, [])

  const setTouched = useCallback((field: keyof T) => {
    setTouchedState((prev) => ({ ...prev, [field]: true }))
    validateField(field)
  }, [validateField])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault()
      }

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {}
      )
      setTouchedState(allTouched)

      if (!validateForm()) {
        toast_error('Verifique os campos destacados')
        return
      }

      setIsSubmitting(true)

      try {
        await onSubmit(values)
        
        if (successMessage) {
          toast_success(successMessage)
        }
        
        if (onSuccess) {
          onSuccess()
        }
        
        if (resetOnSuccess) {
          reset()
        }
      } catch (error) {
        toast_error(errorMessage)
        console.error('Form submission error:', error)
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, validateForm, onSubmit, successMessage, errorMessage, resetOnSuccess, onSuccess]
  )

  const reset = useCallback(() => {
    setValuesState(initialValuesRef.current)
    setErrors({})
    setTouchedState({})
    setIsSubmitting(false)
  }, [])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    setValue,
    setValues,
    setTouched,
    validateField,
    validateForm,
    handleSubmit,
    reset,
    clearErrors,
  }
}
