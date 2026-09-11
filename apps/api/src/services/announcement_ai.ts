import type { panel_ai_completion_input, panel_ai_runtime } from './panel_ai'

const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/isyuricunha/yue-discord-bot/releases/latest'
const GITHUB_PULL_URL = 'https://api.github.com/repos/isyuricunha/yue-discord-bot/pulls'

export type github_release = {
  tag: string
  notes: string
}

export type announcement_complete_fn = (
  input: panel_ai_completion_input,
) => Promise<string>

export function extract_pr_numbers(notes: string): number[] {
  const numbers: number[] = []
  for (const match of notes.matchAll(/#(\d+)/g)) {
    const value = Number(match[1])
    if (Number.isInteger(value) && value > 0 && !numbers.includes(value)) {
      numbers.push(value)
    }
  }
  return numbers.slice(0, 5)
}

/**
 * Fetches the title and body of each pull request referenced in the release
 * notes. PR bodies describe the change for humans, which is far better
 * material for an announcement than the conventional-commit subject line.
 * Fail-soft: a PR that cannot be fetched is simply left out.
 */
export async function fetch_release_pr_summaries(notes: string): Promise<string[]> {
  const summaries: string[] = []
  for (const number of extract_pr_numbers(notes)) {
    try {
      const response = await fetch(`${GITHUB_PULL_URL}/${number}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'yuebot-panel',
        },
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) continue

      const data = (await response.json()) as { title?: unknown; body?: unknown }
      const title = typeof data.title === 'string' ? data.title.trim() : ''
      const body = typeof data.body === 'string' ? data.body.trim().slice(0, 600) : ''
      if (!title && !body) continue
      summaries.push(`#${number} ${title}${body ? `\n${body}` : ''}`)
    } catch {
      // unreachable PR is not worth failing the draft over
    }
  }
  return summaries
}

export function build_release_context(
  release: github_release,
  pr_summaries: string[],
): string {
  const lines = [`Notas técnicas da release ${release.tag}:`, release.notes]
  if (pr_summaries.length > 0) {
    lines.push(
      '',
      'Descrição dos PRs incluídos nesta release (a fonte mais confiável sobre o que mudou para quem usa):',
      ...pr_summaries,
    )
  }
  return lines.join('\n')
}

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
          'Fale em primeira pessoa ("eu"). A Yue nunca se refere a si mesma pelo nome no anúncio.',
          'Regras: linguagem humana e natural, curta, sem jargão técnico, sem inventar informações, mantenha todos os fatos e links do original, responda no mesmo idioma do original.',
          'Nunca use travessão (—, – ou --). Onde aparecer um, reescreva o trecho com vírgula, ponto, parênteses ou "e". Prefira frases curtas e diretas.',
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
  pr_summaries: string[],
  runtime: panel_ai_runtime,
  complete: announcement_complete_fn,
): Promise<string> {
  const input: panel_ai_completion_input = {
    runtime,
    persona: '',
    context: build_release_context(release, pr_summaries),
    messages: [
      {
        role: 'user',
        content: [
          'Escreva o anúncio desta atualização para os membros do servidor, como se VOCÊ fosse a Yue contando o que mudou.',
          'Fale em primeira pessoa ("eu"). A Yue nunca se refere a si mesma pelo nome no anúncio.',
          'Regras: linguagem simples e humana, sem termos técnicos, foco no que mudou na experiência de quem usa, no máximo 150 palavras, sem inventar nada que não esteja nas notas nem nas descrições dos PRs.',
          'O material descreve o que mudou de verdade: liste cada mudança perceptível (no painel, nos comandos, nas páginas) em linguagem simples.',
          'Só trate a versão como atualização de manutenção quando o material não citar nenhuma mudança perceptível; nesse caso, nunca diga que não há mudanças.',
          'Nunca use travessão (—, – ou --). Onde um cairia, reescreva o trecho com vírgula, ponto, parênteses ou "e".',
        ].join('\n'),
      },
    ],
  }

  const response = await complete(input)
  return response.trim()
}
