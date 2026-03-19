import axios from 'axios'

export function get_api_error_message(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any
    const api_message = typeof data?.error === 'string' ? data.error : undefined
    return api_message || error.message || fallback
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return fallback
}
