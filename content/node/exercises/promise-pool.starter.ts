export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  // TODO: respect the limit. This version runs everything at once.
  return Promise.all(items.map((item, index) => fn(item, index)))
}
