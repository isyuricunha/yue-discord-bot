export type ddg_web_search_hit = {
  text: string
  url: string
}

export type ddg_web_search_result = {
  query: string
  abstract_text: string | null
  abstract_url: string | null
  hits: ddg_web_search_hit[]
}

type ddg_instant_answer_topic = {
  Text?: string
  FirstURL?: string
  Topics?: ddg_instant_answer_topic[]
}

type ddg_instant_answer_response = {
  AbstractText?: string
  AbstractURL?: string
  RelatedTopics?: ddg_instant_answer_topic[]
}

export type ddg_web_search_deps = {
  fetch_fn?: typeof fetch
  timeout_ms?: number
}

function is_nonempty_string(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function take_first_hits(topics: ddg_instant_answer_topic[] | undefined, limit: number): ddg_web_search_hit[] {
  const out: ddg_web_search_hit[] = []

  const visit = (arr: ddg_instant_answer_topic[]) => {
    for (const t of arr) {
      if (out.length >= limit) return

      if (t.Topics && Array.isArray(t.Topics)) {
        visit(t.Topics)
        if (out.length >= limit) return
      }

      if (is_nonempty_string(t.Text) && is_nonempty_string(t.FirstURL)) {
        out.push({ text: t.Text.trim(), url: t.FirstURL.trim() })
      }
    }
  }

  if (Array.isArray(topics)) {
    visit(topics)
  }

  return out
}

function decode_html_entities(input: string): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function strip_html_tags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

function normalize_ddg_result_url(input: string): string {
  const trimmed = input.trim()

  try {
    const parsed = new URL(trimmed, 'https://duckduckgo.com')
    const uddg = parsed.searchParams.get('uddg')
    if (uddg && uddg.trim().length > 0) {
      return decodeURIComponent(uddg)
    }
  } catch {
    // ignore
  }

  return trimmed
}

async function ddg_html_search(query: string, deps: ddg_web_search_deps): Promise<ddg_web_search_hit[]> {
  const fetch_fn = deps.fetch_fn ?? fetch
  const timeout_ms = deps.timeout_ms ?? 10_000

  const url = new URL('https://duckduckgo.com/html/')
  url.searchParams.set('q', query)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeout_ms)

  try {
    const res = await fetch_fn(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'text/html',
        'user-agent': 'Mozilla/5.0 (compatible; yue-discord-bot/1.0; +https://github.com/isyuricunha/yue-discord-bot)',
      },
      signal: controller.signal,
    })

    if (!res.ok) return []
    const html = await res.text().catch(() => '')
    if (!html) return []

    const hits: ddg_web_search_hit[] = []
    const seen = new Set<string>()

    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(html)) && hits.length < 5) {
      const href = normalize_ddg_result_url(match[1] ?? '')
      const text = decode_html_entities(strip_html_tags(String(match[2] ?? '')).trim())

      if (!href || !text) continue
      if (seen.has(href)) continue
      seen.add(href)
      hits.push({ url: href, text })
    }

    return hits
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

export function parse_web_search_query(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const patterns: RegExp[] = [
    /^(?:pesquisa|pesquisar|web|search)\s*[:\-,]\s*/i,
    /^(?:pesquisa|pesquisar|web|search)\s+/i,
  ]

  for (const pattern of patterns) {
    const replaced = trimmed.replace(pattern, '')
    if (replaced !== trimmed) {
      const q = replaced.trim()
      return q.length > 0 ? q : null
    }
  }

  return null
}

export async function ddg_web_search(query: string, deps: ddg_web_search_deps = {}): Promise<ddg_web_search_result> {
  const q = query.trim()
  if (!q) {
    return { query: q, abstract_text: null, abstract_url: null, hits: [] }
  }

  const fetch_fn = deps.fetch_fn ?? fetch
  const timeout_ms = deps.timeout_ms ?? 10_000

  const url = new URL('https://api.duckduckgo.com/')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('no_html', '1')
  url.searchParams.set('skip_disambig', '1')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeout_ms)

  try {
    const res = await fetch_fn(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })

    if (!res.ok) {
      return { query: q, abstract_text: null, abstract_url: null, hits: [] }
    }

    const json = (await res.json().catch(() => null)) as ddg_instant_answer_response | null
    if (!json) {
      return { query: q, abstract_text: null, abstract_url: null, hits: [] }
    }

    const abstract_text = is_nonempty_string(json.AbstractText) ? json.AbstractText.trim() : null
    const abstract_url = is_nonempty_string(json.AbstractURL) ? json.AbstractURL.trim() : null
    const hits = take_first_hits(json.RelatedTopics, 5)

    const has_sources = hits.length > 0 || (abstract_text && abstract_url)
    if (has_sources) {
      return { query: q, abstract_text, abstract_url, hits }
    }

    const html_hits = await ddg_html_search(q, deps)
    return { query: q, abstract_text: null, abstract_url: null, hits: html_hits }
  } catch {
    const html_hits = await ddg_html_search(q, deps)
    return { query: q, abstract_text: null, abstract_url: null, hits: html_hits }
  } finally {
    clearTimeout(timeout)
  }
}

export function format_web_search_context(result: ddg_web_search_result): string {
  const lines: string[] = []
  lines.push(`Web search query: ${result.query}`)

  if (result.abstract_text) {
    lines.push('')
    lines.push('Abstract:')
    lines.push(result.abstract_text)
  }

  const sources: ddg_web_search_hit[] = []
  if (result.abstract_url && result.abstract_text) {
    sources.push({ text: 'DuckDuckGo Abstract Source', url: result.abstract_url })
  }
  sources.push(...result.hits)

  lines.push('')
  if (sources.length === 0) {
    lines.push('No sources were found for this query.')
  } else {
    lines.push('Sources:')
    for (const hit of sources) {
      lines.push(`- ${hit.url} (${hit.text})`)
    }
  }

  return lines.join('\n')
}
