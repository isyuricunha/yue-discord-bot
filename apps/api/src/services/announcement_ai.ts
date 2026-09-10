import type { panel_ai_completion_input, panel_ai_runtime } from './panel_ai'

const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/isyuricunha/yue-discord-bot/releases/latest'

export type github_release = {
  tag: string
  notes: string
}

export type announcement_complete_fn = (
  input: panel_ai_completion_input,
) => Promise<string>

export async function fetch_latest_release(): Promise<github_release | null> {
  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'yuebot-panel',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null

    const data = (await response.json()) as { tag_name?: unknown; body?: unknown }
    const tag = typeof data.tag_name === 'string' ? data.tag_name : ''
    if (!tag) return null

    const notes = typeof data.body === 'string' ? data.body : ''
    return { tag, notes: notes.slice(0, 4000) }
  } catch {
    return null
  }
}

/**
 * Rewrites an owner draft in the assistant's voice: same information, human
 * phrasing, no technical jargon. The draft is never sent anywhere by this
 * function; it only returns text for the owner to review.
 */
export async function humanize_announcement(
  content: string,
  runtime: panel_ai_runtime,
  complete: announcement_complete_fn,
): Promise<string> {
  const input: panel_ai_completion_input = {
    runtime,
    persona: '',
    context: '',
    messages: [
      {
        role: 'user',
        content: [
          'Reescreva o anúncio abaixo como se VOCÊ fosse a Yue anunciando para os membros do servidor.',
          'Regras: linguagem humana e natural, curta, sem jargão técnico, sem inventar informações, mantenha todos os fatos e links do original, responda no mesmo idioma do original.',
          'Não use travessão. Prefira frases curtas e diretas.',
          '',
          'Anúncio:',
          content,
        ].join('\n'),
      },
    ],
  }

  const response = await complete(input)
  return response.trim()
}

/**
 * Turns the technical notes of a GitHub release into a short, human
 * announcement draft in the assistant's voice. Returns null when the release
 * cannot be fetched; the caller decides what to tell the owner.
 */
export async function draft_release_announcement(
  release: github_release,
  runtime: panel_ai_runtime,
  complete: announcement_complete_fn,
): Promise<string> {
  const input: panel_ai_completion_input = {
    runtime,
    persona: '',
    context: `Notas técnicas da release ${release.tag}:\n${release.notes}`,
    messages: [
      {
        role: 'user',
        content: [
          'Escreva o anúncio desta atualização para os membros do servidor, como se você fosse a Yue contando o que mudou.',
          'Regras: linguagem simples e humana, sem termos técnicos, foco no que mudou na experiência de quem usa, no máximo 150 palavras, sem travessão, sem inventar nada que não esteja nas notas.',
          'Se as notas forem só correções internas, diga de forma leve que foi uma atualização de manutenção.',
        ].join('\n'),
      },
    ],
  }

  const response = await complete(input)
  return response.trim()
}
