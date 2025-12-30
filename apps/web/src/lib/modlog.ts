export function normalize_modlog_action(action: string): string {
  return String(action ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase()
}

export function get_modlog_action_label(action: string): string {
  const normalized = normalize_modlog_action(action)

  const labels: Record<string, string> = {
    BAN: 'Banimento',
    UNBAN: 'Remover ban',
    KICK: 'Expulsão',
    WARN: 'Aviso',
    WARN_EXPIRED: 'Aviso expirado',
    MUTE: 'Timeout',
    TIMEOUT: 'Timeout',
    UNMUTE: 'Remover timeout',
    UNTIMEOUT: 'Remover timeout',
    MUTE_REAPPLY: 'Timeout reaplicado',
    AUTOMOD: 'AutoMod',
  }

  return labels[normalized] ?? normalized
}
