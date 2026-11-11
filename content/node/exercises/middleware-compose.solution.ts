export type Next = () => Promise<void>
export type Middleware<C> = (ctx: C, next: Next) => Promise<void> | void

export function compose<C>(middleware: Middleware<C>[]): (ctx: C) => Promise<void> {
  return ctx => {
    let index = -1
    const dispatch = (i: number): Promise<void> => {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i
      const fn = middleware[i]
      if (!fn) return Promise.resolve()
      try {
        return Promise.resolve(fn(ctx, () => dispatch(i + 1)))
      } catch (error) {
        return Promise.reject(error)
      }
    }
    return dispatch(0)
  }
}
