export interface AsyncStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export type Migration = (data: any) => any
export interface StoreOptions<T> { key: string; version: number; defaults: T; migrations: Record<number, Migration> }

export function createSettingsStore<T extends object>(storage: AsyncStorage, options: StoreOptions<T>) {
  return {
    async load(): Promise<T> {
      const raw = await storage.getItem(options.key)
      return raw ? JSON.parse(raw).data : options.defaults
    },
    async update(patch: Partial<T>): Promise<T> {
      const next = { ...(await this.load()), ...patch }
      await storage.setItem(options.key, JSON.stringify(next))
      return next
    },
  }
}
