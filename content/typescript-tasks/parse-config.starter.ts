// TODO: make Result a discriminated union on `ok`, then validate the input.
export type Result<T, E> = { ok: boolean; value?: T; error?: E }

export interface Config {
  port: number
  host: string
  tags: string[]
  mode: 'dev' | 'prod'
}

export function parseConfig(input: unknown): Result<Config, string[]> {
  return { ok: false, error: ['not implemented'] }
}
