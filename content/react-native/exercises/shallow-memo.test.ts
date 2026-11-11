import { createSelector, shallowEqual } from './index'

export function testShallowEqualBasics() {
  assert(shallowEqual(1, 1))
  assert(shallowEqual(NaN, NaN))
  assert(!shallowEqual(0, -0), 'Object.is semantics')
  assert(shallowEqual({ a: 1, b: 'x' }, { b: 'x', a: 1 }))
  assert(!shallowEqual({ a: 1 }, { a: 1, b: undefined }))
  assert(!shallowEqual(null, {}))
}

export function testShallowIsNotDeep() {
  const list = [1]
  assert(shallowEqual({ list }, { list }))
  assert(!shallowEqual({ list: [1] }, { list: [1] }))
  assert(!shallowEqual({ f: () => 1 }, { f: () => 1 }))
}

export function testSelectorCaches() {
  const state = { todos: [{ done: true }, { done: false }], filter: 'done' }
  const selectDone = createSelector([(s: typeof state) => s.todos, (s: typeof state) => s.filter], (todos: { done: boolean }[], filter: string) => todos.filter(t => (filter === 'done') === t.done))
  const first = selectDone(state)
  const second = selectDone({ ...state })
  assert(first === second, 'same inputs return the cached array')
  assertEqual(selectDone.recomputations(), 1)
  selectDone({ ...state, filter: 'open' })
  assertEqual(selectDone.recomputations(), 2)
}
