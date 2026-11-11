import { flattenStyle } from './index'

export function testPlainObjectIsCopied() {
  const style = { padding: 4 }
  const flat = flattenStyle(style)
  assertEqual(flat, { padding: 4 })
  assert(flat !== style, 'returns a new object')
}

export function testLaterValuesWin() {
  assertEqual(flattenStyle([{ padding: 4, margin: 1 }, { padding: 8 }]), { padding: 8, margin: 1 })
}

export function testNestedAndFalsy() {
  const disabled = false
  assertEqual(flattenStyle([{ a: 1 }, disabled && { a: 2 }, null, [undefined, [{ b: 2 }], { a: 3 }]]), { a: 3, b: 2 })
}

export function testFalsyTopLevel() {
  assertEqual(flattenStyle(null), {})
  assertEqual(flattenStyle(false), {})
}

export function testDoesNotMutate() {
  const first = { color: 'red' }
  flattenStyle([first, { color: 'blue' }])
  assertEqual(first, { color: 'red' })
}
