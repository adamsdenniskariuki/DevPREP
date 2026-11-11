import { createRequire } from './index'

export function testReturnsExports() {
  const require = createRequire({ math: module => { module.exports.add = (a: number, b: number) => a + b } })
  assertEqual(require('math').add(2, 3), 5)
}

export function testRunsEachModuleOnce() {
  let runs = 0
  const require = createRequire({ counter: module => { runs++; module.exports = { value: 0 } } })
  require('counter').value++
  assertEqual(require('counter').value, 1)
  assertEqual(runs, 1)
}

export function testSupportsReplacingExports() {
  const require = createRequire({ greet: module => { module.exports = (name: string) => `hi ${name}` } })
  assertEqual(require('greet')('ada'), 'hi ada')
}

export function testCircularGetsPartialExports() {
  const seen: unknown[] = []
  const require = createRequire({
    a: (module, req) => { module.exports.early = true; req('b'); module.exports.late = true },
    b: (module, req) => { const a = req('a'); seen.push(a.early, a.late) },
  })
  require('a')
  assertEqual(seen, [true, undefined])
}

export function testUnknownModuleThrows() {
  const require = createRequire({})
  assertThrows(() => require('missing'), "Cannot find module 'missing'")
}

export function testDoesNotResolveInheritedNames() {
  const require = createRequire({})
  assertThrows(() => require('toString'), "Cannot find module 'toString'")
}
