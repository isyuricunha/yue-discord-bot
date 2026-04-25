/**
 * Formata um número para exibição compacta (K, M).
 * Retorna '---' para valores nulos, NaN ou negativos.
 */
export function formatNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num) || num < 0) {
    return '---'
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}
