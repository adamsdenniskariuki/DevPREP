export interface Config {
  port: number
  nodeEnv: 'development' | 'test' | 'production'
  databaseUrl: string
  debug: boolean
  corsOrigins: string[]
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  // TODO: validate, default and freeze.
  return {
    port: Number(env.PORT),
    nodeEnv: env.NODE_ENV as Config['nodeEnv'],
    databaseUrl: env.DATABASE_URL ?? '',
    debug: Boolean(env.DEBUG),
    corsOrigins: (env.CORS_ORIGINS ?? '').split(','),
  }
}
