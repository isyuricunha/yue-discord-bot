export type safe_error_details_payload = {
  name?: string
  message: string
  code?: string
  statusCode?: number
  status?: number
}

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function safe_error_details(error: unknown): safe_error_details_payload {
  if (error instanceof Error) {
    const any_error = error as unknown as { code?: unknown; statusCode?: unknown }

    const details: safe_error_details_payload = {
      name: error.name,
      message: error.message,
    }

    if (typeof any_error.code === 'string') {
      details.code = any_error.code
    }

    if (typeof any_error.statusCode === 'number') {
      details.statusCode = any_error.statusCode
    }

    return details
  }

  if (is_record(error)) {
    const details: safe_error_details_payload = {
      message: typeof error.message === 'string' ? error.message : 'Unknown error',
    }

    if (typeof error.name === 'string') {
      details.name = error.name
    }

    if (typeof error.code === 'string') {
      details.code = error.code
    }

    if (typeof error.statusCode === 'number') {
      details.statusCode = error.statusCode
    }

    if (typeof error.status === 'number') {
      details.status = error.status
    }

    const is_axios_error = error.isAxiosError === true
    if (is_axios_error) {
      const response = is_record(error.response) ? error.response : undefined
      if (response && typeof response.status === 'number') {
        details.status = response.status
      }
    }

    return details
  }

  return { message: 'Unknown error' }
}
