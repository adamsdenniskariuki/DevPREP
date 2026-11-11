import { safeMerge } from './index'

export function testDeepMerges() {
  const merged = safeMerge({ server: { port: 80, host: 'a' }, tags: ['x'] }, { server: { port: 8080 }, tags: ['y'] })
  assertEqual(merged, { server: { port: 8080, host: 'a' }, tags: ['y'] })
}

export function testDoesNotMutateInputs() {
  const target = { server: { port: 80 } }
  const source = { server: { port: 81 } }
  safeMerge(target, source)
  assertEqual(target, { server: { port: 80 } })
}

export function testBlocksProtoPollution() {
  const evil = JSON.parse('{"__proto__": {"isAdmin": true}, "nested": {"__proto__": {"polluted": 1}}}')
  const merged = safeMerge({ nested: {} }, evil)
  assertEqual(({} as Record<string, unknown>).isAdmin, undefined)
  assertEqual(({} as Record<string, unknown>).polluted, undefined)
  assertEqual(Object.getPrototypeOf(merged), Object.prototype)
}

export function testBlocksConstructorPrototype() {
  const evil = JSON.parse('{"constructor": {"prototype": {"hacked": true}}}')
  safeMerge({}, evil)
  assertEqual(({} as Record<string, unknown>).hacked, undefined)
}
