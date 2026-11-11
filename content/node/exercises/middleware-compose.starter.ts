export type Next = () => Promise<void>
export type Middleware<C> = (ctx: C, next: Next) => Promise<void> | void

export function compose<C>(middleware: Middleware<C>[]): (ctx: C) => Promise<void> {
  return async ctx => {
    // TODO: let each middleware decide when (and whether) the rest of the chain runs.
    for (const fn of middleware) await fn(ctx, async () => {})
  }
}
