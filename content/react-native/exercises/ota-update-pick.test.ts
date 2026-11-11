import { bucket, pickUpdate } from './index'
import type { Update } from './index'

const device = { runtimeVersion: '2.1', channel: 'production', currentUpdateId: null as string | null, installId: 'install-1' }
const u = (id: string, createdAt: number, extra: Partial<Update> = {}): Update => ({ id, runtimeVersion: '2.1', channel: 'production', createdAt, rolloutPercent: 100, ...extra })

export function testNewestCompatible() {
  const picked = pickUpdate(device, [u('a', 1), u('b', 3), u('c', 2), u('d', 9, { runtimeVersion: '2.2' }), u('e', 8, { channel: 'staging' })])
  assertEqual(picked && picked.id, 'b')
}

export function testRuntimeVersionIsExact() {
  assertEqual(pickUpdate(device, [u('x', 1, { runtimeVersion: '2.1.0' }), u('y', 2, { runtimeVersion: '2.0' })]), null)
}

export function testAlreadyRunning() {
  assertEqual(pickUpdate({ ...device, currentUpdateId: 'b' }, [u('a', 1), u('b', 3)]), null)
}

export function testRollout() {
  const inside = bucket('install-1', 'r')
  assertEqual(pickUpdate(device, [u('r', 5, { rolloutPercent: inside })]), null)
  const picked = pickUpdate(device, [u('r', 5, { rolloutPercent: inside + 1 })])
  assertEqual(picked && picked.id, 'r')
}

export function testRollbacks() {
  const picked = pickUpdate({ ...device, currentUpdateId: 'b' }, [u('a', 1), u('b', 3, { rolledBack: true })])
  assertEqual(picked && picked.id, 'a')
  assertEqual(pickUpdate({ ...device, currentUpdateId: 'b' }, [u('b', 3, { rolledBack: true })]), { id: 'embedded' })
}
