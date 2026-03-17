type image_attachment_like = {
  url: string | null
  contentType: string | null
  name: string | null
  width?: number | null
  height?: number | null
}

type embed_like = {
  imageUrl: string | null
  thumbnailUrl: string | null
}

type extract_input = {
  attachments: image_attachment_like[]
  embeds: embed_like[]
}

const image_exts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])
const image_formats = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])

function normalize_image_url(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 2048) return null

  // Some providers (and some Discord embeds) may include a trailing '&' that breaks URL parsing / downstream APIs.
  const without_trailing_amp = trimmed.replace(/&+$/g, '')

  try {
    const url = new URL(without_trailing_amp)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function is_likely_image_url(value: string): boolean {
  const normalized = normalize_image_url(value)
  if (!normalized) return false

  try {
    const url = new URL(normalized)
    const pathname = url.pathname.toLowerCase()

    for (const ext of image_exts) {
      if (pathname.endsWith(ext)) return true
    }

    const format = url.searchParams.get('format')
    if (format && image_formats.has(format.toLowerCase())) return true
    return false
  } catch {
    return false
  }
}

function is_image_attachment(att: image_attachment_like) {
  if (typeof att.contentType === 'string' && att.contentType.startsWith('image/')) return true

  if (typeof att.width === 'number' && typeof att.height === 'number' && att.width > 0 && att.height > 0) {
    return true
  }

  const name = typeof att.name === 'string' ? att.name.toLowerCase() : ''
  for (const ext of image_exts) {
    if (name.endsWith(ext)) return true
  }

  const url = typeof att.url === 'string' ? att.url : ''
  return Boolean(url) && is_likely_image_url(url)
}

export function extract_ai_moderation_image_urls(input: extract_input): string[] {
  const urls = new Set<string>()

  for (const att of input.attachments) {
    if (!att.url) continue
    if (!is_image_attachment(att)) continue
    const normalized = normalize_image_url(att.url)
    if (!normalized) continue
    urls.add(normalized)
    if (urls.size >= 10) break
  }

  if (urls.size < 10) {
    for (const embed of input.embeds) {
      const url = embed.imageUrl ?? embed.thumbnailUrl
      if (!url) continue
      const normalized = normalize_image_url(url)
      if (!normalized) continue
      urls.add(normalized)
      if (urls.size >= 10) break
    }
  }

  return Array.from(urls)
}
