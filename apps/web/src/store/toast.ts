import { create } from 'zustand'

export type toast_variant = 'default' | 'success' | 'error'

export type toast_item = {
  id: string
  title?: string
  message: string
  variant: toast_variant
  created_at: number
  duration_ms: number
}

type toast_state = {
  toasts: toast_item[]
  push: (toast: Omit<toast_item, 'id' | 'created_at'> & { id?: string }) => string
  dismiss: (id: string) => void
  clear: () => void
}

function random_id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const MAX_TOASTS = 3

export const useToastStore = create<toast_state>((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = toast.id ?? random_id()
    const duration_ms = toast.duration_ms

    const item: toast_item = {
      id,
      title: toast.title,
      message: toast.message,
      variant: toast.variant,
      duration_ms,
      created_at: Date.now(),
    }

    set((state) => {
      const next = [item, ...state.toasts]
      return { toasts: next.slice(0, MAX_TOASTS) }
    })

    if (duration_ms > 0) {
      window.setTimeout(() => {
        get().dismiss(id)
      }, duration_ms)
    }

    return id
  },

  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  clear: () => {
    set({ toasts: [] })
  },
}))

export function toast_success(message: string, title = 'Sucesso') {
  return useToastStore.getState().push({
    title,
    message,
    variant: 'success',
    duration_ms: 3500,
  })
}

export function toast_error(message: string, title = 'Erro') {
  return useToastStore.getState().push({
    title,
    message,
    variant: 'error',
    duration_ms: 5500,
  })
}

export function toast_info(message: string, title?: string) {
  return useToastStore.getState().push({
    title,
    message,
    variant: 'default',
    duration_ms: 3500,
  })
}
