const yue_keyword_regex = /\byue\b/i

export function contains_yue_keyword(input: string): boolean {
  return yue_keyword_regex.test(input)
}

function escape_regexp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function remove_bot_mention(input: string, bot_user_id: string): string {
  const id = escape_regexp(bot_user_id)
  const mention_regex = new RegExp(`<@!?${id}>`, 'g')
  return input.replace(mention_regex, ' ').replace(/\s+/g, ' ').trim()
}

export function remove_leading_yue(input: string): string {
  return input.replace(/^\s*yue\s*[:\-,]?\s*/i, '').trim()
}

export function build_user_prompt_from_invocation(input: {
  content: string
  mentions_bot: boolean
  bot_user_id: string | null
}): string | null {
  const raw = input.content?.trim() ?? ''
  if (!raw) return null

  const triggered = input.mentions_bot || contains_yue_keyword(raw)
  if (!triggered) return null

  let cleaned = raw

  if (input.mentions_bot && input.bot_user_id) {
    cleaned = remove_bot_mention(cleaned, input.bot_user_id)
  }

  cleaned = remove_leading_yue(cleaned)

  if (cleaned.length === 0) {
    return 'Say hello.'
  }

  return cleaned
}
