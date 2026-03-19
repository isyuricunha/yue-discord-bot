/**
 * Traduções para categorias de moderação do OpenAI em português brasileiro
 */

export type OpenAiModerationCategory =
  | 'harassment'
  | 'harassment/threatening'
  | 'hate'
  | 'hate/threatening'
  | 'illicit'
  | 'illicit/violent'
  | 'self-harm'
  | 'self-harm/intent'
  | 'self-harm/instructions'
  | 'sexual'
  | 'sexual/minors'
  | 'violence'
  | 'violence/graphic'

export const moderationCategoryTranslations: Record<OpenAiModerationCategory, string> = {
  'harassment': 'Assédio',
  'harassment/threatening': 'Assédio com Ameaças',
  'hate': 'Discurso de Ódio',
  'hate/threatening': 'Discurso de Ódio com Ameaças',
  'illicit': 'Conteúdo Ilícito',
  'illicit/violent': 'Conteúdo Ilícito e Violento',
  'self-harm': 'Autoagressão',
  'self-harm/intent': 'Intenção de Autoagressão',
  'self-harm/instructions': 'Instruções de Autoagressão',
  'sexual': 'Conteúdo Sexual',
  'sexual/minors': 'Conteúdo Sexual com Menores',
  'violence': 'Violência',
  'violence/graphic': 'Violência Gráfica',
}

export function getModerationCategoryTranslation(category: OpenAiModerationCategory): string {
  return moderationCategoryTranslations[category] || category
}
