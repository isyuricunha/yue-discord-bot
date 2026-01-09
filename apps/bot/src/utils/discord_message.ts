export const DISCORD_MESSAGE_MAX_CHARS = 2000

type split_options = {
  max_chars?: number
}

function clamp_nonempty_max(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  if (value <= 0) return fallback
  return Math.floor(value)
}

function is_fence_line(line: string): boolean {
  return line.trim().startsWith('```')
}

export function split_discord_message(input: string, options: split_options = {}): string[] {
  const max_chars = clamp_nonempty_max(options.max_chars ?? DISCORD_MESSAGE_MAX_CHARS, DISCORD_MESSAGE_MAX_CHARS)

  const raw = typeof input === 'string' ? input : String(input)
  const text = raw.trim()
  if (!text) return ['']
  if (text.length <= max_chars) return [text]

  const lines = text.split('\n')

  const out: string[] = []
  let open_fence: string | null = null
  let current = ''

  const close_overhead = () => {
    if (!open_fence) return 0
    return current.length === 0 || current.endsWith('\n') ? 3 : 4
  }

  const close_if_needed = (value: string): string => {
    if (!open_fence) return value
    if (value.length === 0) return '```'
    return value.endsWith('\n') ? `${value}\`\`\`` : `${value}\n\`\`\``
  }

  const reopen_if_needed = (): void => {
    if (!open_fence) return
    current = `${open_fence}\n`
  }

  const push_chunk = (): void => {
    const chunk = close_if_needed(current).trimEnd()
    if (chunk.length > 0) out.push(chunk)
    current = ''
    reopen_if_needed()
  }

  const append_text = (value: string): void => {
    const piece = current.length === 0 ? value : `\n${value}`
    const required = close_overhead()

    if (current.length + piece.length + required <= max_chars) {
      current += piece
      return
    }

    if (current.length > 0) {
      push_chunk()
      append_text(value)
      return
    }

    // value is too large even for an empty chunk
    let remaining = value
    while (remaining.length > 0) {
      const overhead = close_overhead()
      const space = Math.max(1, max_chars - overhead)
      const take = Math.min(space, remaining.length)
      current = remaining.slice(0, take)
      remaining = remaining.slice(take)
      push_chunk()
    }
  }

  for (const line of lines) {
    append_text(line)

    if (is_fence_line(line)) {
      if (open_fence) {
        open_fence = null
      } else {
        open_fence = line.trim()
      }
    }
  }

  if (current.trim().length > 0) {
    out.push(close_if_needed(current).trimEnd())
  }

  return out.length > 0 ? out : ['']
}
