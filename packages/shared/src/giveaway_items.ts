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

  // First, split by newlines, commas, and semicolons
  const tokens = raw
    .split(/[\n,;]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const choices: string[] = []

  for (const token of tokens) {
    // Check if this token contains only space-separated numbers
    const spaceSeparatedNumbers = token.split(/\s+/)
    const allNumbers = spaceSeparatedNumbers.every(t => /^\d+$/.test(t.trim()))
    
    if (allNumbers) {
      // Add each number individually
      spaceSeparatedNumbers.forEach(num => {
        if (num.trim()) choices.push(num.trim())
      })
    } else {
      // Handle as before for mixed content
      const without_prefix = token.replace(/^\s*(?:\d+[.:)]\s*|[-*•]\s*)/g, '')
      const cleaned = clean_giveaway_item_label(without_prefix)
      if (!cleaned) continue
      choices.push(cleaned)
    }
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

// Parse quantity from item name, e.g., "Item (x5)" -> { name: "Item", quantity: 5 }
export function parse_giveaway_item_quantity(item: string): { name: string; quantity: number } {
  const cleaned = clean_giveaway_item_label(item)
  
  // Match pattern like (x2), (x10), ( x5 ), etc. at the end
  // This regex matches optional spaces before 'x', required digits, optional spaces after digits
  const quantityMatch = cleaned.match(/\s*\(\s*x\s*(\d+)\s*\)\s*$/i)
  
  if (quantityMatch) {
    const quantity = parseInt(quantityMatch[1], 10)
    const name = cleaned.slice(0, quantityMatch.index).trim()
    return { name: name, quantity: Math.max(1, quantity) }
  }
  
  return { name: cleaned, quantity: 1 }
}

// Parse list of items with quantities
export function parse_giveaway_items_with_quantities(items: string[]): { name: string; quantity: number; original: string }[] {
  return items.map(original => {
    const parsed = parse_giveaway_item_quantity(original)
    return { ...parsed, original }
  })
}

// Enhanced version that supports both item names and numeric indices
export function match_giveaway_choices(params: {
  availableItems: string[]
  choices: string[]
}): { invalid: string[]; resolved: string[] } {
  const available = Array.isArray(params.availableItems) ? params.availableItems : []
  const choices = Array.isArray(params.choices) ? params.choices : []

  // Create mapping for name-based matching
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

  // Create mapping for index-based matching (1-based indexing)
  const index_to_item = new Map<number, string>()
  available.forEach((item, index) => {
    const cleaned = clean_giveaway_item_label(item)
    if (cleaned) {
      index_to_item.set(index + 1, cleaned) // 1-based indexing for users
    }
  })

  const invalid: string[] = []
  const resolved: string[] = []

  for (const choice of choices) {
    const cleaned_choice = clean_giveaway_item_label(choice)
    
    // Try numeric index matching first
    const numeric_match = cleaned_choice.match(/^(\d+)$/)
    if (numeric_match) {
      const index = parseInt(numeric_match[1], 10)
      const item = index_to_item.get(index)
      if (item) {
        resolved.push(item)
        continue
      }
    }

    // Try name-based matching
    const normalized_choice = normalize_giveaway_item_label(cleaned_choice)
    const match = normalized_to_item.get(normalized_choice)
    if (match) {
      resolved.push(match)
      continue
    }

    // If no match found, add to invalid
    if (cleaned_choice) invalid.push(cleaned_choice)
  }

  return { invalid, resolved }
}
