import axios from 'axios'
import { logger } from './logger'

// Lista de serviços conhecidos de encurtamento de URLs
const URL_SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'bit.do',
  'lnkd.in',
  'mcaf.ee',
  'q.gs',
  's2r.co',
  'su.pr',
  't2m.io',
  'tr.im',
  'v.gd',
  'x.co',
  'youtu.be',
  'rebrand.ly',
  'short.link',
  'tny.im',
  'cutt.ly',
  'shorte.st',
  'linktr.ee',
]

export function isShortUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    return URL_SHORTENERS.some(shortener => 
      hostname === shortener || hostname.endsWith(`.${shortener}`)
    )
  } catch {
    return false
  }
}

export async function expandUrl(shortUrl: string, maxRedirects = 5): Promise<string> {
  let currentUrl = shortUrl
  let redirectCount = 0

  try {
    while (redirectCount < maxRedirects) {
      const response = await axios.head(currentUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 5000,
      })

      // Se não há redirecionamento, retornar URL atual
      if (response.status < 300 || response.status >= 400) {
        return currentUrl
      }

      // Obter URL de redirecionamento
      const location = response.headers.location
      if (!location) {
        return currentUrl
      }

      // Se a location for relativa, construir URL completa
      if (location.startsWith('/')) {
        const urlObj = new URL(currentUrl)
        currentUrl = `${urlObj.protocol}//${urlObj.host}${location}`
      } else if (location.startsWith('http')) {
        currentUrl = location
      } else {
        // Location relativa sem barra inicial
        const urlObj = new URL(currentUrl)
        const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1)
        currentUrl = `${urlObj.protocol}//${urlObj.host}${basePath}${location}`
      }

      redirectCount++
    }

    logger.warn(`Max redirects (${maxRedirects}) reached for ${shortUrl}`)
    return currentUrl
  } catch (error: any) {
    logger.error({ err: error }, `Error expanding URL ${shortUrl}: ${error?.message ?? 'unknown error'}`)
    // Em caso de erro, retornar a URL original
    return shortUrl
  }
}

export function extractUrls(text: string): string[] {
  // Regex para detectar URLs
  const urlRegex = /(https?:\/\/[^\s]+)/gi
  const matches = text.match(urlRegex)
  return matches || []
}

export async function expandShortUrls(text: string): Promise<{ original: string; expanded: string }[]> {
  const urls = extractUrls(text)
  const results: { original: string; expanded: string }[] = []

  for (const url of urls) {
    if (isShortUrl(url)) {
      const expanded = await expandUrl(url)
      results.push({ original: url, expanded })
    }
  }

  return results
}
