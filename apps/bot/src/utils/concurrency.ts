export async function map_with_concurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []

  const normalized_concurrency = Number.isFinite(concurrency)
    ? Math.max(1, Math.floor(concurrency))
    : items.length
  const worker_count = Math.min(items.length, normalized_concurrency)
  const results = new Array<R>(items.length)

  let next_index = 0
  let failure: { error: unknown } | null = null

  const worker = async () => {
    while (!failure) {
      const index = next_index
      next_index += 1

      if (index >= items.length) return

      try {
        results[index] = await mapper(items[index], index)
      } catch (error) {
        failure = { error }
      }
    }
  }

  await Promise.all(Array.from({ length: worker_count }, () => worker()))

  if (failure) throw failure.error
  return results
}
