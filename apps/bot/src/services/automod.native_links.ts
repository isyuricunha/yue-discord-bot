import { normalize_link_domain, normalize_link_domains } from '@yuebot/shared'

const DISCORD_REGEX_PATTERN_LIMIT = 10
const DISCORD_REGEX_CHARACTER_LIMIT = 260
const NATIVE_LINK_START = String.raw`(?:^|[\s<({\["'])`

export const NATIVE_ALL_LINKS_REGEX =
  `${NATIVE_LINK_START}(?:https?://|www\\.)?` +
  '(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+' +
  '[a-z]{2,63}(?::[0-9]{1,5})?(?:[/?#]|[^a-z0-9.-]|$)'

function escape_regex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function build_native_blocked_domain_regex(domain: string): string | null {
  const normalized = normalize_link_domain(domain)
  if (!normalized) return null

  const escapedDomain = escape_regex(normalized)
  const pattern =
    `${NATIVE_LINK_START}(?:https?://|www\\.)?` +
    `(?:[a-z0-9-]+\\.)*${escapedDomain}` +
    '(?::[0-9]{1,5})?(?:[/?#]|[^a-z0-9.-]|$)'

  return pattern.length <= DISCORD_REGEX_CHARACTER_LIMIT ? pattern : null
}

export function build_native_blocked_domain_patterns(domains: string[]): string[] {
  return normalize_link_domains(domains)
    .map(build_native_blocked_domain_regex)
    .filter((pattern): pattern is string => pattern !== null)
    .slice(0, DISCORD_REGEX_PATTERN_LIMIT)
}

export function can_sync_native_link_rule(trustedDomains: string[]): boolean {
  return normalize_link_domains(trustedDomains).length === 0
}
