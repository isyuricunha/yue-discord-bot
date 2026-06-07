const LINK_CANDIDATE_REGEX =
  /(?<![@\w-])(?:(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:\/[^\s<>()]*)?)/gi

const TRAILING_URL_PUNCTUATION = /[.,!?;:'"\]}>]+$/g

export type automod_link_rule = 'blocked_domain' | 'all_links' | 'member_without_roles'

export type automod_link_violation = {
  rule: automod_link_rule
  hostname: string
  configuredDomain?: string
}

export type automod_link_policy_input = {
  content: string
  linkFilterEnabled: boolean
  linkBlockAll: boolean
  blockedDomains: string[]
  trustedDomains: string[]
  noRoleEnabled: boolean
  memberHasRoles: boolean
}

export function normalize_link_domain(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/^\*\./, '')
  if (!trimmed) return null

  const explicitScheme = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]
  if (explicitScheme && explicitScheme !== 'http' && explicitScheme !== 'https') {
    return null
  }

  try {
    const parsed = new URL(explicitScheme ? trimmed : `https://${trimmed}`)
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
    if (!hostname || hostname.length > 253) return null
    return hostname
  } catch {
    return null
  }
}

export function normalize_link_domains(values: string[]): string[] {
  const normalized = values
    .map(normalize_link_domain)
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(normalized))
}

export function extract_link_hostnames(content: string): string[] {
  const candidates = content.match(LINK_CANDIDATE_REGEX) ?? []
  const hostnames = candidates
    .map((candidate) => candidate.replace(TRAILING_URL_PUNCTUATION, ''))
    .map(normalize_link_domain)
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(hostnames))
}

export function link_hostname_matches_domain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function find_matching_domain(hostname: string, domains: string[]): string | null {
  return domains.find((domain) => link_hostname_matches_domain(hostname, domain)) ?? null
}

export function evaluate_automod_link_policy(
  input: automod_link_policy_input,
): automod_link_violation | null {
  if (!input.linkFilterEnabled && !input.noRoleEnabled) return null

  const hostnames = extract_link_hostnames(input.content)
  if (hostnames.length === 0) return null

  const blockedDomains = normalize_link_domains(input.blockedDomains)
  const trustedDomains = normalize_link_domains(input.trustedDomains)

  for (const hostname of hostnames) {
    if (find_matching_domain(hostname, trustedDomains)) continue

    if (input.linkFilterEnabled) {
      const blockedDomain = find_matching_domain(hostname, blockedDomains)
      if (blockedDomain) {
        return {
          rule: 'blocked_domain',
          hostname,
          configuredDomain: blockedDomain,
        }
      }

      if (input.linkBlockAll) {
        return { rule: 'all_links', hostname }
      }
    }

    if (input.noRoleEnabled && !input.memberHasRoles) {
      return { rule: 'member_without_roles', hostname }
    }
  }

  return null
}
