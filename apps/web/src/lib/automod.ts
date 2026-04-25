/**
 * Constantes e utilitários compartilhados para AutoMod e Moderação.
 */

export type automod_action = 'delete' | 'warn' | 'mute' | 'kick' | 'ban'

export const action_label: Record<automod_action, string> = {
  delete: 'Deletar',
  warn: 'Avisar',
  mute: 'Silenciar',
  kick: 'Expulsar',
  ban: 'Banir',
}

export const action_description: Record<automod_action, string> = {
  delete: 'Remove a mensagem. Não aplica punição ao usuário.',
  warn: 'Remove a mensagem e registra 1 warn no usuário (pode contar para thresholds).',
  mute: 'Remove a mensagem e aplica timeout de 5 minutos no usuário.',
  kick: 'Remove a mensagem e expulsa o usuário do servidor.',
  ban: 'Remove a mensagem e bane o usuário do servidor.',
}

export function describe_action(value: unknown) {
  const key = value as automod_action
  if (!key || !(key in action_description)) return ''
  return action_description[key]
}

export type ai_moderation_level = 'permissivo' | 'brando' | 'medio' | 'rigoroso' | 'maximo'

export const ai_level_label: Record<ai_moderation_level, string> = {
  permissivo: 'Permissivo',
  brando: 'Brando',
  medio: 'Médio',
  rigoroso: 'Rigoroso',
  maximo: 'Máximo',
}

export const ai_level_description: Record<ai_moderation_level, string> = {
  permissivo: 'Quase tudo passa. Só conteúdo bem explícito será punido.',
  brando: 'Mais permissivo que o padrão, mas ainda barra casos evidentes.',
  medio: 'Equilíbrio (recomendado).',
  rigoroso: 'Mais restritivo. Penaliza com mais frequência.',
  maximo: 'Quase nada passa. Use apenas se você quiser tolerância mínima.',
}
