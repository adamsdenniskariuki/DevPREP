import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const port = Number(process.argv[2] ?? process.env.PWA_TEST_PORT ?? 4383)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PWA test port')
const origin = `http://127.0.0.1:${port}`
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
}
const mounts = new Map()
function reset() {
  for (const mount of ['/', '/DevPREP/']) mounts.set(mount, { release: 'v1', fault: null, hits: 0 })
}
reset()
function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(value))
}
async function body(request) {
  let text = ''
  for await (const chunk of request) {
    text += chunk
    if (text.length > 4096) throw new Error('Control body too large')
  }
  return JSON.parse(text || '{}')
}

const server = createServer(async (request, response) => {
  try {
    if (request.socket.remoteAddress !== '127.0.0.1' || request.headers.host !== `127.0.0.1:${port}`) {
      return json(response, 403, { error: 'Loopback requests only' })
    }
    const url = new URL(request.url, origin)
    if (url.pathname.startsWith('/__pwa_test__/')) {
      if (request.headers.origin && request.headers.origin !== origin ||
        request.headers['sec-fetch-site'] === 'cross-site') return json(response, 403, { error: 'Same-origin controls only' })
      if (url.pathname === '/__pwa_test__/health' && request.method === 'GET') return json(response, 200, { ok: true })
      if (request.method !== 'POST') return json(response, 405, { error: 'POST required' })
      if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: 'JSON required' })
      const data = await body(request)
      const action = url.pathname.slice('/__pwa_test__/'.length)
      if (action === 'reset') {
        reset()
        return json(response, 200, { ok: true })
      }
      const state = mounts.get(data.mount)
      if (!state) return json(response, 400, { error: 'Unknown mount' })
      if (action === 'release') {
        if (!['v1', 'v2'].includes(data.release)) return json(response, 400, { error: 'Unknown release' })
        state.release = data.release
      } else if (action === 'fault') {
        if (data.fault !== null && !['network', 'tamper'].includes(data.fault)) return json(response, 400, { error: 'Unknown fault' })
        state.fault = data.fault
        state.hits = 0
      } else if (action !== 'state') return json(response, 404, { error: 'Unknown control' })
      return json(response, 200, state)
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { error: 'Read-only artifact server' })
    if (url.pathname === '/DevPREP') {
      response.writeHead(308, { Location: '/DevPREP/' }).end()
      return
    }
    const mount = url.pathname.startsWith('/DevPREP/') ? '/DevPREP/' : '/'
    const state = mounts.get(mount)
    const relative = decodeURIComponent(url.pathname.slice(mount.length)) || 'index.html'
    const root = resolve('dist-pwa-tests', state.release)
    const path = resolve(root, relative)
    if (!path.startsWith(`${root}${sep}`) || relative.includes('\\')) return json(response, 404, { error: 'Not found' })
    let bytes
    try { bytes = await readFile(path) } catch { return json(response, 404, { error: 'Not found in current release' }) }
    // Fetches made by the real worker have destination "empty"; initial browser module loads must succeed.
    if (state.fault && /^assets\/curriculum-[^/]+\.js$/.test(relative) && request.headers['sec-fetch-dest'] === 'empty') {
      state.hits++
      if (state.fault === 'network') return json(response, 503, { error: 'Injected worker precache failure' })
      bytes = Buffer.concat([bytes, Buffer.from('\n/* injected SHA-256 mismatch */\n')])
    }
    response.writeHead(200, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-PWA-Test-Release': state.release,
    }).end(request.method === 'HEAD' ? undefined : bytes)
  } catch (error) {
    json(response, 400, { error: error.message })
  }
})
server.on('error', error => { console.error(error); process.exit(1) })
server.listen(port, '127.0.0.1')
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)))
