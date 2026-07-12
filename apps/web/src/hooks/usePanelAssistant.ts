import { useCallback, useMemo } from 'react'

import { panel_ai_page_key } from '@yuebot/shared'
import { getApiUrl } from '../env'

const API_URL = getApiUrl()

export type chat_send_result =
  | { ok: true; response: string }
  | { ok: false; error: string }

type panel_assistant_client = {
  send: (message: string, signal: AbortSignal, pageContext?: { pageKey: panel_ai_page_key }) => Promise<chat_send_result>
}

export function usePanelAssistant(guildId: string | undefined): panel_assistant_client {
  const send = useCallback(
    async (message: string, signal: AbortSignal, pageContext?: { pageKey: panel_ai_page_key }): Promise<chat_send_result> => {
      if (!guildId) return { ok: false, error: 'Guild unavailable' }

      try {
        const response = await fetch(`${API_URL}/api/guilds/${guildId}/panel-ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify(pageContext ? { message, pageContext } : { message }),
          credentials: 'include',
        })


        if (!response.ok) {
          const body = await response.json().catch(() => null)
          return { ok: false, error: typeof body?.error === 'string' ? body.error : 'Serviço indisponível' }
        }

        const data = await response.json().catch(() => null)
        if (typeof data?.response !== 'string') {
          return { ok: false, error: 'Resposta inválida do assistente' }
        }

        return { ok: true, response: data.response }
      } catch (error: unknown) {
        if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return { ok: false, error: 'Cancelled' }
        }
        return { ok: false, error: 'Falha na comunicação' }
      }
    },
    [guildId]
  )

  return useMemo(() => ({ send }), [send])
}
