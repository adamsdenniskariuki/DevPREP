export interface Config {
  port: number
  nodeEnv: 'development' | 'test' | 'production'
  databaseUrl: string
  debug: boolean
  corsOrigins: string[]
}

const ENVS = ['development', 'test', 'production'] as const

export function loadConfig(env: Record<string, string | undefined>): Config {
  const problems: string[] = []
  const value = (name: string) => (env[name] ?? '').trim()

  let port = 3000
  if (value('PORT')) {
    const n = Number(value('PORT'))
    if (Number.isInteger(n) && n >= 1 && n <= 65535) port = n
    else problems.push('PORT must be an integer from 1 to 65535')
  }

  let nodeEnv: Config['nodeEnv'] = 'development'
  if (value('NODE_ENV')) {
    const found = ENVS.find(e => e === value('NODE_ENV'))
    if (found) nodeEnv = found
    else problems.push(`NODE_ENV must be one of ${ENVS.join(', ')}`)
  }

  const databaseUrl = value('DATABASE_URL')
  if (!databaseUrl) problems.push('DATABASE_URL is required')
  else if (!databaseUrl.startsWith('postgres://')) problems.push('DATABASE_URL must start with postgres://')

  let debug = false
  const rawDebug = value('DEBUG').toLowerCase()
  if (rawDebug === 'true' || rawDebug === '1') debug = true
  else if (rawDebug && rawDebug !== 'false' && rawDebug !== '0') problems.push('DEBUG must be true, false, 1 or 0')

  const corsOrigins = value('CORS_ORIGINS').split(',').map(s => s.trim()).filter(Boolean)

  if (problems.length) throw new Error(`Invalid config: ${problems.join('; ')}`)
  return Object.freeze({ port, nodeEnv, databaseUrl, debug, corsOrigins: Object.freeze(corsOrigins) as string[] })
}
