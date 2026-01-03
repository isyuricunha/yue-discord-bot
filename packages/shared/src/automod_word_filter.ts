export type banned_word_entry = {
  word: string
  action: string
}

type parsed_rule =
  | {
      kind: 'literal'
      value: string
    }
  | {
      kind: 'regex'
      source: string
      flags: string
      regex: RegExp
    }

type match_result = {
  matched: boolean
  matched_rule?: string
  match_kind?: 'literal' | 'regex'
}

function escape_regex(literal: string) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parse_regex_rule(input: string): parsed_rule | null {
  const trimmed = input.trim()

  if (trimmed.toLowerCase().startsWith('re:')) {
    const pattern = trimmed.slice(3).trim()
    if (!pattern) return null
    try {
      return {
        kind: 'regex',
        source: pattern,
        flags: 'iu',
        regex: new RegExp(pattern, 'iu'),
      }
    } catch {
      return null
    }
  }

  // /pattern/flags
  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const last = trimmed.lastIndexOf('/')
    const pattern = trimmed.slice(1, last)
    const flags_raw = trimmed.slice(last + 1)

    if (!pattern) return null

    const flags_set = new Set<string>()
    for (const ch of flags_raw) {
      flags_set.add(ch)
    }

    // We always add 'u' for unicode safety.
    flags_set.add('u')
    flags_set.add('i')

    const flags = Array.from(flags_set).join('')

    try {
      return {
        kind: 'regex',
        source: pattern,
        flags,
        regex: new RegExp(pattern, flags),
      }
    } catch {
      return null
    }
  }

  return null
}

function parse_rule(word: string): parsed_rule | null {
  const trimmed = word.trim()
  if (!trimmed) return null

  const regex = parse_regex_rule(trimmed)
  if (regex) return regex

  return { kind: 'literal', value: trimmed }
}

function match_literal_whole_word(content: string, literal: string): boolean {
  const word = literal.trim()
  if (!word) return false

  // Whole-word match using unicode letter/number boundaries.
  // This avoids false positives like "ass" in "class".
  const pattern = `(^|[^\\p{L}\\p{N}])${escape_regex(word)}($|[^\\p{L}\\p{N}])`
  const re = new RegExp(pattern, 'iu')
  return re.test(content)
}

export function match_banned_word(content: string, entry: banned_word_entry): match_result {
  const rule = parse_rule(entry.word)
  if (!rule) return { matched: false }

  if (rule.kind === 'regex') {
    return {
      matched: rule.regex.test(content),
      matched_rule: entry.word,
      match_kind: 'regex',
    }
  }

  return {
    matched: match_literal_whole_word(content, rule.value),
    matched_rule: entry.word,
    match_kind: 'literal',
  }
}

export function find_first_banned_word_match(content: string, rules: banned_word_entry[]): (match_result & { entry: banned_word_entry }) | null {
  for (const entry of rules) {
    const res = match_banned_word(content, entry)
    if (res.matched) {
      return { ...res, entry }
    }
  }

  return null
}
