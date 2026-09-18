import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, readFile, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

async function fingerprint(directory: string): Promise<string> {
  const hash = createHash('sha256')
  async function visit(path: string) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      hash.update(entry.name)
      if (entry.isDirectory()) await visit(join(path, entry.name))
      else hash.update(await readFile(join(path, entry.name)))
    }
  }
  await visit(directory)
  return hash.digest('hex')
}

export default async function setup() {
  const original = resolve('dist')
  for (const name of ['index.html', 'sw.js', 'manifest.webmanifest']) {
    try { await readFile(join(original, name)) } catch {
      throw new Error(`Production PWA tests require dist/${name}. Run npm run build first; this suite never overwrites dist.`)
    }
  }
  const before = await fingerprint(original)
  await rm(resolve('dist-pwa-tests'), { recursive: true, force: true })
  await cp(original, resolve('dist-pwa-tests', 'v1'), { recursive: true })
  const result = spawnSync(process.execPath, [
    resolve('node_modules', 'vite', 'bin', 'vite.js'),
    'build', '--outDir', 'dist-pwa-tests/v2',
  ], {
    cwd: process.cwd(),
    env: { ...process.env, DEVPREP_RELEASE: 'pwa-test-v2' },
    stdio: 'inherit',
    timeout: 180_000,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`PWA v2 production build exited with ${result.status}`)
  if (await fingerprint(original) !== before) throw new Error('PWA setup changed the original dist artifact')
  const first = await readFile(resolve('dist-pwa-tests', 'v1', 'index.html'), 'utf8')
  const second = await readFile(resolve('dist-pwa-tests', 'v2', 'index.html'), 'utf8')
  const entry = (html: string) => html.match(/<script[^>]+src="([^"]+)"/)?.[1]
  if (!entry(first) || entry(first) === entry(second)) {
    throw new Error('v1 and v2 must have genuinely different client entry assets. Build v1 without DEVPREP_RELEASE=pwa-test-v2; render __APP_RELEASE__ in the UI.')
  }
  if ((await readFile(resolve('dist-pwa-tests', 'v1', 'sw.js'))).equals(await readFile(resolve('dist-pwa-tests', 'v2', 'sw.js')))) {
    throw new Error('The two production service workers unexpectedly have identical manifests')
  }
}
