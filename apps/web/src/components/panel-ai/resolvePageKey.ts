import { matchPath } from 'react-router-dom'
import { PANEL_AI_PAGES, panel_ai_page_key } from '@yuebot/shared'

export function resolvePanelAiPageKey(pathname: string): panel_ai_page_key | null {
  if (typeof pathname !== 'string') return null

  // Strip query string and hash
  let cleanPath = pathname.split('?')[0].split('#')[0]

  // Normalize trailing slash (but preserve "/" itself)
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1)
  }

  for (const page of PANEL_AI_PAGES) {
    const match = matchPath({ path: page.routePattern, end: true }, cleanPath)
    if (match) {
      return page.key
    }
  }
  return null
}
