import { matchPath } from 'react-router-dom'
import {
  PANEL_AI_PAGES,
  type panel_ai_page_context,
  type panel_ai_page_key,
} from '@yuebot/shared'

export function resolvePanelAiPageContext(pathname: string): panel_ai_page_context | null {
  if (typeof pathname !== 'string') return null

  let cleanPath = pathname.split('?')[0].split('#')[0]
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1)
  }

  for (const page of PANEL_AI_PAGES) {
    const match = matchPath({ path: page.routePattern, end: true }, cleanPath)
    if (!match) continue

    const routeParams: Record<string, string> = {}
    for (const [key, value] of Object.entries(match.params)) {
      if (key === 'guildId' || typeof value !== 'string' || !value.trim()) continue
      routeParams[key] = value
    }

    return {
      pageKey: page.key,
      ...(Object.keys(routeParams).length > 0 ? { routeParams } : {}),
    }
  }
  return null
}

export function resolvePanelAiPageKey(pathname: string): panel_ai_page_key | null {
  return resolvePanelAiPageContext(pathname)?.pageKey ?? null
}
