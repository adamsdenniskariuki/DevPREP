export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export interface Config {
  port: number
  host: string
  tags: string[]
  mode: 'dev' | 'prod'
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isPort = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
const isHost = (value: unknown): value is string => typeof value === 'string' && value !== ''
const isTags = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
const isMode = (value: unknown): value is Config['mode'] => value === 'dev' || value === 'prod'

export function parseConfig(input: unknown): Result<Config, string[]> {
  if (!isRecord(input)) return { ok: false, error: ['config must be an object'] }
  const { port, host, tags = [], mode = 'dev' } = input
  const errors: string[] = []
  if (!isPort(port)) errors.push('port must be an integer from 1 to 65535')
  if (!isHost(host)) errors.push('host must be a non-empty string')
  if (!isTags(tags)) errors.push('tags must be an array of strings')
  if (!isMode(mode)) errors.push('mode must be "dev" or "prod"')
  if (!isPort(port) || !isHost(host) || !isTags(tags) || !isMode(mode)) return { ok: false, error: errors }
  return { ok: true, value: { port, host, tags, mode } }
}
