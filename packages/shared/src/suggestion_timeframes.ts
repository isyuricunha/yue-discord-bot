export const SUGGESTION_TIMEFRAMES = ['30d', '60d', '3m', '6m'] as const

export type suggestion_timeframe = (typeof SUGGESTION_TIMEFRAMES)[number]

export function is_suggestion_timeframe(input: unknown): input is suggestion_timeframe {
  return typeof input === 'string' && (SUGGESTION_TIMEFRAMES as readonly string[]).includes(input)
}

export function parse_suggestion_timeframe(input: unknown): suggestion_timeframe | null {
  if (!is_suggestion_timeframe(input)) return null
  return input
}

function subtract_months_utc_clamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()

  const total_months = year * 12 + month - months
  const target_year = Math.floor(total_months / 12)
  const target_month = total_months % 12

  const last_day_of_target_month = new Date(Date.UTC(target_year, target_month + 1, 0)).getUTCDate()
  const clamped_day = Math.min(day, last_day_of_target_month)

  return new Date(
    Date.UTC(
      target_year,
      target_month,
      clamped_day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  )
}

export function get_suggestion_timeframe_start_date(timeframe: suggestion_timeframe, now: Date = new Date()): Date {
  if (timeframe === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  if (timeframe === '60d') {
    return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  }

  if (timeframe === '3m') {
    return subtract_months_utc_clamped(now, 3)
  }

  return subtract_months_utc_clamped(now, 6)
}

export function suggestion_timeframe_label(timeframe: suggestion_timeframe): string {
  if (timeframe === '30d') return 'Últimos 30 dias'
  if (timeframe === '60d') return 'Últimos 60 dias'
  if (timeframe === '3m') return 'Últimos 3 meses'
  return 'Últimos 6 meses'
}
