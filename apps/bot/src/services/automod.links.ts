import type { GuildConfig, Prisma } from '@yuebot/database'
import { evaluate_automod_link_policy } from '@yuebot/shared'

export type automod_action = 'delete' | 'warn' | 'mute' | 'kick' | 'ban'

export type automod_link_check_result =
  | { violated: false }
  | {
      violated: true
      reason: string
      action: automod_action
      duration?: string
      details: Prisma.InputJsonValue
    }

type automod_link_config = Pick<
  GuildConfig,
  | 'linkFilterEnabled'
  | 'linkBlockAll'
  | 'bannedDomains'
  | 'allowedDomains'
  | 'linkAction'
  | 'linkTimeoutDuration'
  | 'linkNoRoleEnabled'
  | 'linkNoRoleAction'
  | 'linkNoRoleTimeoutDuration'
>

function normalize_string_array(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalize_action(value: string, fallback: automod_action): automod_action {
  if (value === 'delete' || value === 'warn' || value === 'mute' || value === 'kick' || value === 'ban') {
    return value
  }
  return fallback
}

export function check_automod_link_message(input: {
  content: string
  memberHasRoles: boolean
  config: automod_link_config
}): automod_link_check_result {
  const violation = evaluate_automod_link_policy({
    content: input.content,
    linkFilterEnabled: input.config.linkFilterEnabled,
    linkBlockAll: input.config.linkBlockAll,
    blockedDomains: normalize_string_array(input.config.bannedDomains),
    trustedDomains: normalize_string_array(input.config.allowedDomains),
    noRoleEnabled: input.config.linkNoRoleEnabled,
    memberHasRoles: input.memberHasRoles,
  })

  if (!violation) return { violated: false }

  const usesNoRolePolicy = violation.rule === 'member_without_roles'
  const action = usesNoRolePolicy
    ? normalize_action(input.config.linkNoRoleAction, 'mute')
    : normalize_action(input.config.linkAction, 'delete')
  const duration = action === 'mute'
    ? usesNoRolePolicy
      ? input.config.linkNoRoleTimeoutDuration
      : input.config.linkTimeoutDuration
    : undefined

  const reason = (() => {
    if (violation.rule === 'blocked_domain') {
      return `Domínio bloqueado pelo AutoMod: ${violation.configuredDomain ?? violation.hostname}`
    }
    if (violation.rule === 'all_links') {
      return 'Links não autorizados neste servidor'
    }
    return 'Link publicado por membro sem cargos'
  })()

  return {
    violated: true,
    reason,
    action,
    duration,
    details: {
      policy: violation.rule,
      hostname: violation.hostname,
      configuredDomain: violation.configuredDomain ?? null,
      memberHasRoles: input.memberHasRoles,
    } satisfies Prisma.InputJsonObject,
  }
}
