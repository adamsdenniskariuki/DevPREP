export interface AsyncStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export type Migration = (data: any) => any
export interface StoreOptions<T> { key: string; version: number; defaults: T; migrations: Record<number, Migration> }

export function createSettingsStore<T extends object>(storage: AsyncStorage, options: StoreOptions<T>) {
  const { key, version, defaults, migrations } = options
  let cached: Promise<T> | undefined
  const save = (data: T) => storage.setItem(key, JSON.stringify({ version, data }))

  async function read(): Promise<T> {
    const raw = await storage.getItem(key)
    if (raw === null) return { ...defaults }
    let stored: { version: number; data: unknown }
    try { stored = JSON.parse(raw) } catch { return { ...defaults } }
    if (!stored || typeof stored.version !== 'number' || stored.version > version) return { ...defaults }
    let data: any = stored.data
    for (let v = stored.version; v < version; v++) data = migrations[v](data)
    const value = { ...defaults, ...data } as T
    if (stored.version < version) await save(value)
    return value
  }

  return {
    load(): Promise<T> {
      cached ??= read()
      return cached
    },
    async update(patch: Partial<T>): Promise<T> {
      const next = { ...(await this.load()), ...patch }
      cached = Promise.resolve(next)
      await save(next)
      return next
    },
  }
}
