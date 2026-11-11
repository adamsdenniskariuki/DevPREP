export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every(key => Object.prototype.hasOwnProperty.call(b, key) && Object.is((a as any)[key], (b as any)[key]))
}

export function createSelector<S, R>(inputs: Array<(state: S) => unknown>, combine: (...values: any[]) => R) {
  let count = 0
  let lastArgs: unknown[] | undefined
  let lastResult: R
  const selector = (state: S): R => {
    const args = inputs.map(input => input(state))
    if (!lastArgs || args.some((arg, i) => !Object.is(arg, lastArgs![i]))) {
      lastArgs = args
      lastResult = combine(...args)
      count++
    }
    return lastResult
  }
  return Object.assign(selector, { recomputations: () => count })
}
