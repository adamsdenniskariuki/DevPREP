import { parseConfig } from './index'

export function testAcceptsAValidConfig() {
  const result = parseConfig({ port: 8080, host: 'localhost', tags: ['api'], mode: 'prod', extra: true })
  if (!result.ok) throw new Error(result.error.join('; '))
  assertEqual(result.value, { port: 8080, host: 'localhost', tags: ['api'], mode: 'prod' })
}

export function testFillsInDefaults() {
  const result = parseConfig({ port: 3000, host: 'example.test' })
  if (!result.ok) throw new Error(result.error.join('; '))
  assertEqual(result.value.tags, [])
  assertEqual(result.value.mode, 'dev')
}

export function testCollectsEveryErrorInOrder() {
  const result = parseConfig({ port: '80', host: '', tags: ['ok', 1], mode: 'test' })
  if (result.ok) throw new Error('expected errors')
  assertEqual(result.error, ['port must be an integer from 1 to 65535', 'host must be a non-empty string', 'tags must be an array of strings', 'mode must be "dev" or "prod"'])
}

export function testRejectsPortsOutOfRange() {
  for (const port of [0, 65536, 1.5]) {
    const result = parseConfig({ port, host: 'h' })
    if (result.ok) throw new Error(`port ${port} should fail`)
    assertEqual(result.error, ['port must be an integer from 1 to 65535'])
  }
}

export function testRejectsWhatIsNotAPlainObject() {
  for (const input of [null, [], 'port=80', 42]) {
    const result = parseConfig(input)
    if (result.ok) throw new Error('expected an error')
    assertEqual(result.error, ['config must be an object'])
  }
}

export function testResultIsADiscriminatedUnion() {
  const result = parseConfig({ port: 1, host: 'h' })
  if (!result.ok) throw new Error('expected a config')
  const mode: 'dev' | 'prod' = result.value.mode
  // @ts-expect-error a success has no error
  void result.error
  assertEqual(mode, 'dev')
}
