export function clean_giveaway_item_label(input: string): string {
  let value = String(input ?? '')
    .normalize('NFKC')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()

  value = value.replace(/^"|"$/g, '').trim()
  value = value.replace(/\s+/g, ' ')

  return value
}

export function normalize_giveaway_item_label(input: string): string {
  return clean_giveaway_item_label(input).toLowerCase()
}

export function parse_giveaway_items_input(input: string): string[] {
  const raw = String(input ?? '').replace(/\r/g, '')

  const tokens = raw
    .split(/[\n,;]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const normalized_seen = new Set<string>()
  const items: string[] = []

  for (const token of tokens) {
    const without_prefix = token.replace(/^\s*(?:\d+[.:)]\s*|[-*•]\s*)/g, '')
    const cleaned = clean_giveaway_item_label(without_prefix)
    if (!cleaned) continue

    const normalized = normalize_giveaway_item_label(cleaned)
    if (!normalized) continue
    if (normalized_seen.has(normalized)) continue

    normalized_seen.add(normalized)
    items.push(cleaned)
  }

  return items
}

export function parse_giveaway_choices_input(input: string): string[] {
  const raw = String(input ?? '').replace(/\r/g, '')

  const tokens = raw
    .split(/[\n,;]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const choices: string[] = []

  for (const token of tokens) {
    const without_prefix = token.replace(/^\s*(?:\d+[.:)]\s*|[-*•]\s*)/g, '')
    const cleaned = clean_giveaway_item_label(without_prefix)
    if (!cleaned) continue
    choices.push(cleaned)
  }

  return choices
}

export function normalize_giveaway_items_list(items: string[]): string[] {
  const normalized_seen = new Set<string>()
  const normalized_items: string[] = []

  for (const item of Array.isArray(items) ? items : []) {
    const cleaned = clean_giveaway_item_label(item)
    if (!cleaned) continue

    const normalized = normalize_giveaway_item_label(cleaned)
    if (!normalized) continue
    if (normalized_seen.has(normalized)) continue

    normalized_seen.add(normalized)
    normalized_items.push(cleaned)
  }

  // Ordenar itens alfabéticamente (case-insensitive)
  return normalized_items.sort((a, b) => 
    a.toLowerCase().localeCompare(b.toLowerCase(), 'pt-BR')
  )
}

export function match_giveaway_choices(params: {
  availableItems: string[]
  choices: string[]
}): { invalid: string[]; resolved: string[] } {
  const available = Array.isArray(params.availableItems) ? params.availableItems : []
  const choices = Array.isArray(params.choices) ? params.choices : []

  const normalized_to_item = new Map<string, string>()

  for (const item of available) {
    const cleaned = clean_giveaway_item_label(item)
    if (!cleaned) continue
    const normalized = normalize_giveaway_item_label(cleaned)
    if (!normalized) continue
    if (!normalized_to_item.has(normalized)) {
      normalized_to_item.set(normalized, cleaned)
    }
  }

  const invalid: string[] = []
  const resolved: string[] = []

  for (const choice of choices) {
    const cleaned_choice = clean_giveaway_item_label(choice)
    const normalized_choice = normalize_giveaway_item_label(cleaned_choice)

    const match = normalized_to_item.get(normalized_choice)
    if (!match) {
      if (cleaned_choice) invalid.push(cleaned_choice)
      continue
    }

    resolved.push(match)
  }

  return { invalid, resolved }
}
