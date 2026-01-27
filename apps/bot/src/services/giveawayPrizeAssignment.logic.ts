import {
  clean_giveaway_item_label,
  normalize_giveaway_item_label,
  parse_giveaway_item_quantity,
} from '@yuebot/shared'

export type giveaway_winner_entry = {
  userId: string
  username: string
  choices?: string[] | null
}

export type giveaway_prize_assignment = {
  userId: string
  username: string
  prize: string | null
  prizeIndex: number | null
}

export function assign_giveaway_prizes(input: {
  winners: giveaway_winner_entry[]
  availableItems: string[]
}): giveaway_prize_assignment[] {
  const pool_by_name = new Map<
    string,
    {
      name: string
      normalizedName: string
      total: number
      available: number
      prizeIndex: number
    }
  >()

  for (let i = 0; i < (Array.isArray(input.availableItems) ? input.availableItems.length : 0); i++) {
    const raw = input.availableItems[i]
    const cleaned = clean_giveaway_item_label(raw)
    if (!cleaned) continue

    const parsed = parse_giveaway_item_quantity(cleaned)
    const base_name = clean_giveaway_item_label(parsed.name)
    const normalized_name = normalize_giveaway_item_label(base_name)
    if (!normalized_name) continue

    const quantity = Number.isFinite(parsed.quantity) ? Math.max(1, Math.floor(parsed.quantity)) : 1

    const existing = pool_by_name.get(normalized_name)
    if (existing) {
      existing.total += quantity
      existing.available += quantity
      continue
    }

    pool_by_name.set(normalized_name, {
      name: base_name,
      normalizedName: normalized_name,
      total: quantity,
      available: quantity,
      prizeIndex: i,
    })
  }

  const pool = Array.from(pool_by_name.values())

  const results: giveaway_prize_assignment[] = []
  const user_prizes = new Map<string, Set<string>>()

  for (const winner of Array.isArray(input.winners) ? input.winners : []) {
    const choices = Array.isArray(winner.choices) ? winner.choices : []

    let assigned_prize: string | null = null
    let prize_index: number | null = null

    for (const choice of choices) {
      const parsed_choice = parse_giveaway_item_quantity(choice)
      const base_choice = clean_giveaway_item_label(parsed_choice.name)
      const normalized_choice = normalize_giveaway_item_label(base_choice)
      if (!normalized_choice) continue

      const item = pool_by_name.get(normalized_choice)
      if (!item || item.available <= 0) continue

      const prize_set = user_prizes.get(winner.userId) || new Set<string>()
      if (prize_set.has(item.normalizedName)) continue

      assigned_prize = item.name
      prize_index = item.prizeIndex
      item.available--
      prize_set.add(item.normalizedName)
      user_prizes.set(winner.userId, prize_set)
      break
    }

    if (!assigned_prize) {
      for (const item of pool) {
        if (item.available <= 0) continue

        const prize_set = user_prizes.get(winner.userId) || new Set<string>()
        if (prize_set.has(item.normalizedName)) continue

        assigned_prize = item.name
        prize_index = item.prizeIndex
        item.available--
        prize_set.add(item.normalizedName)
        user_prizes.set(winner.userId, prize_set)
        break
      }
    }

    results.push({
      userId: winner.userId,
      username: winner.username,
      prize: assigned_prize,
      prizeIndex: prize_index,
    })
  }

  return results
}
