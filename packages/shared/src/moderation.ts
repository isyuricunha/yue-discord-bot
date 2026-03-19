/**
 * Centralized moderation logic and constants
 * Replaces duplicated code across multiple components
 */

import type { AiModerationLevel } from './moderation_translations'

// Types
export type AutomodAction = 'delete' | 'warn' | 'mute' | 'kick' | 'ban'

// Labels
export const AUTOMOD_ACTION_LABELS: Record<AutomodAction, string> = {
  delete: 'Deletar',
  warn: 'Avisar',
  mute: 'Silenciar',
  kick: 'Expulsar',
  ban: 'Banir',
}

export const AI_LEVEL_LABELS: Record<AiModerationLevel, string> = {
  permissivo: 'Permissivo',
  brando: 'Brando',
  medio: 'Médio',
  rigoroso: 'Rigoroso',
  maximo: 'Máximo',
}

// Descriptions
export const AUTOMOD_ACTION_DESCRIPTIONS: Record<AutomodAction, string> = {
  delete: 'Remove a mensagem. Não aplica punição ao usuário.',
  warn: 'Remove a mensagem e registra 1 warn no usuário (pode contar para thresholds).',
  mute: 'Remove a mensagem e aplica timeout de 5 minutos no usuário.',
  kick: 'Remove a mensagem e expulsa o usuário do servidor.',
  ban: 'Remove a mensagem e bane o usuário do servidor.',
}

export const AI_LEVEL_DESCRIPTIONS: Record<AiModerationLevel, string> = {
  permissivo: 'Apenas conteúdo extremamente ofensivo será sinalizado (threshold: 0.95)',
  brando: 'Conteúdo moderadamente ofensivo será sinalizado (threshold: 0.85)',
  medio: 'Equilíbrio entre falsos positivos e proteção (threshold: 0.75)',
  rigoroso: 'Mais sensível, detecta conteúdo borderline (threshold: 0.65)',
  maximo: 'Extremamente sensível, pode gerar mais falsos positivos (threshold: 0.55)',
}

// Legacy descriptions (for AutoMod.tsx compatibility)
export const AI_LEVEL_DESCRIPTIONS_LEGACY: Record<AiModerationLevel, string> = {
  permissivo: 'Quase tudo passa. Só conteúdo bem explícito será punido.',
  brando: 'Mais permissivo que o padrão, mas ainda barra casos evidentes.',
  medio: 'Equilíbrio (recomendado).',
  rigoroso: 'Mais restritivo. Penaliza com mais frequência.',
  maximo: 'Quase nada passa. Use apenas se você quiser tolerância mínima.',
}

// Threshold values
export const AI_LEVEL_THRESHOLDS: Record<AiModerationLevel, number> = {
  permissivo: 0.95,
  brando: 0.85,
  medio: 0.75,
  rigoroso: 0.65,
  maximo: 0.55,
}

// Helper functions
export function getAutomodActionLabel(action: AutomodAction): string {
  return AUTOMOD_ACTION_LABELS[action] || action
}

export function getAutomodActionDescription(action: AutomodAction): string {
  return AUTOMOD_ACTION_DESCRIPTIONS[action] || ''
}

export function getAiLevelLabel(level: AiModerationLevel): string {
  return AI_LEVEL_LABELS[level] || level
}

export function getAiLevelDescription(level: AiModerationLevel, useLegacy = false): string {
  if (useLegacy) {
    return AI_LEVEL_DESCRIPTIONS_LEGACY[level] || ''
  }
  return AI_LEVEL_DESCRIPTIONS[level] || ''
}

export function getAiLevelThreshold(level: AiModerationLevel): number {
  return AI_LEVEL_THRESHOLDS[level] || 0.75
}

export function isValidAutomodAction(value: unknown): value is AutomodAction {
  return typeof value === 'string' && value in AUTOMOD_ACTION_LABELS
}

export function isValidAiLevel(value: unknown): value is AiModerationLevel {
  return typeof value === 'string' && value in AI_LEVEL_LABELS
}

// Validation helpers
export function validateThresholdValue(value: number): boolean {
  return !Number.isNaN(value) && value >= 0 && value <= 1
}

export function getThresholdValidationMessage(value: number): string | null {
  if (!validateThresholdValue(value)) {
    return 'Valor deve estar entre 0.00 e 1.00'
  }
  
  if (value < 0.1) {
    return '⚠️ Valor muito baixo pode gerar muitos falsos positivos'
  }
  
  if (value > 0.9) {
    return '⚠️ Valor muito alto pode gerar muitos falsos negativos'
  }
  
  return null
}
