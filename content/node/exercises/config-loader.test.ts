import { loadConfig } from './index'

const DB = 'postgres://app@localhost/app'

export function testDefaults() {
  assertEqual(loadConfig({ DATABASE_URL: DB }), { port: 3000, nodeEnv: 'development', databaseUrl: DB, debug: false, corsOrigins: [] })
}

export function testParsesValues() {
  const config = loadConfig({ DATABASE_URL: DB, PORT: '8080', NODE_ENV: 'production', DEBUG: '1', CORS_ORIGINS: ' https://a.test, ,https://b.test ' })
  assertEqual(config, { port: 8080, nodeEnv: 'production', databaseUrl: DB, debug: true, corsOrigins: ['https://a.test', 'https://b.test'] })
}

export function testRequiresDatabaseUrl() {
  assertThrows(() => loadConfig({}), 'DATABASE_URL is required')
  assertThrows(() => loadConfig({ DATABASE_URL: 'mysql://x' }), 'postgres://')
}

export function testListsEveryProblem() {
  let message = ''
  try { loadConfig({ PORT: '99999', NODE_ENV: 'staging', DEBUG: 'yes' }) } catch (error) { message = (error as Error).message }
  assert(message.startsWith('Invalid config:'), message)
  for (const name of ['PORT', 'NODE_ENV', 'DATABASE_URL', 'DEBUG']) assert(message.includes(name), `missing ${name} in: ${message}`)
}

export function testResultIsFrozen() {
  const config = loadConfig({ DATABASE_URL: DB })
  assert(Object.isFrozen(config), 'config should be frozen')
}
