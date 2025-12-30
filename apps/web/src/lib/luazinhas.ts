function format_int_ptbr(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '0'

  const negative = trimmed.startsWith('-')
  const digits = (negative ? trimmed.slice(1) : trimmed).replace(/^0+/, '')
  const safe_digits = digits.length > 0 ? digits : '0'

  let out = ''
  for (let i = 0; i < safe_digits.length; i++) {
    const idx_from_end = safe_digits.length - i
    out += safe_digits[i]
    if (idx_from_end > 1 && idx_from_end % 3 === 1) out += '.'
  }

  return negative && safe_digits !== '0' ? `-${out}` : out
}

export function format_luazinhas(input: string | number | bigint): string {
  if (typeof input === 'bigint') return format_int_ptbr(input.toString())

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return '0'
    return format_int_ptbr(String(Math.trunc(input)))
  }

  const trimmed = input.trim()
  if (!trimmed) return '0'

  if (/^-?\d+$/.test(trimmed)) {
    return format_int_ptbr(trimmed)
  }

  try {
    return format_int_ptbr(BigInt(trimmed).toString())
  } catch {
    const parsed = Number.parseFloat(trimmed)
    if (!Number.isFinite(parsed)) return '0'
    return format_int_ptbr(String(Math.trunc(parsed)))
  }
}
