import { createSettingsStore } from './index'

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial }
  const log: string[] = []
  return {
    data, log,
    async getItem(key: string) { log.push(`get:${key}`); return key in data ? data[key] : null },
    async setItem(key: string, value: string) { log.push(`set:${key}`); data[key] = value },
  }
}

const defaults = { theme: 'light', fontScale: 1, haptics: true }

export async function testDefaultsWhenEmptyOrCorrupt() {
  assertEqual(await createSettingsStore(memory(), { key: 's', version: 2, defaults, migrations: {} }).load(), defaults)
  assertEqual(await createSettingsStore(memory({ s: '{oops' }), { key: 's', version: 2, defaults, migrations: {} }).load(), defaults)
  assertEqual(await createSettingsStore(memory({ s: JSON.stringify({ version: 9, data: { theme: 'x' } }) }), { key: 's', version: 2, defaults, migrations: {} }).load(), defaults)
}

export async function testCachesReads() {
  const storage = memory({ s: JSON.stringify({ version: 2, data: { theme: 'dark' } }) })
  const store = createSettingsStore(storage, { key: 's', version: 2, defaults, migrations: {} })
  const [a, b] = await Promise.all([store.load(), store.load()])
  await store.load()
  assertEqual(a, { ...defaults, theme: 'dark' })
  assertEqual(b, a)
  assertEqual(storage.log, ['get:s'])
}

export async function testMigratesInOrderAndSaves() {
  const storage = memory({ s: JSON.stringify({ version: 0, data: { dark: true } }) })
  const migrations = {
    0: (d: any) => ({ theme: d.dark ? 'dark' : 'light' }),
    1: (d: any) => ({ ...d, fontScale: 1.2 }),
  }
  const store = createSettingsStore(storage, { key: 's', version: 2, defaults, migrations })
  assertEqual(await store.load(), { theme: 'dark', fontScale: 1.2, haptics: true })
  assertEqual(JSON.parse(storage.data.s), { version: 2, data: { theme: 'dark', fontScale: 1.2, haptics: true } })
}

export async function testUpdateWritesThrough() {
  const storage = memory()
  const store = createSettingsStore(storage, { key: 's', version: 1, defaults, migrations: {} })
  assertEqual(await store.update({ haptics: false }), { ...defaults, haptics: false })
  assertEqual(await store.load(), { ...defaults, haptics: false })
  assertEqual(JSON.parse(storage.data.s), { version: 1, data: { ...defaults, haptics: false } })
  assertEqual(storage.log.filter(entry => entry.startsWith('get')).length, 1)
}
