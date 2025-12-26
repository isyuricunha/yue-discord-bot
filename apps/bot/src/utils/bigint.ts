export function format_bigint(input: bigint): string {
  return new Intl.NumberFormat('pt-BR').format(input)
}
