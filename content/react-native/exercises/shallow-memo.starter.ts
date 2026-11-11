export function shallowEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function createSelector<S, R>(inputs: Array<(state: S) => unknown>, combine: (...values: any[]) => R) {
  let count = 0
  const selector = (state: S): R => {
    count++
    return combine(...inputs.map(input => input(state)))
  }
  return Object.assign(selector, { recomputations: () => count })
}
