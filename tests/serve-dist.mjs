import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}
const files = new Map()
async function load(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const url = `${prefix}/${entry.name}`
    if (entry.isDirectory()) await load(path, url)
    else files.set(url, { body: await readFile(path), type: types[extname(path)] ?? 'application/octet-stream' })
  }
}
await load('dist')
if (!files.has('/index.html')) throw new Error('Build dist before running browser tests')

// Serve identical bytes at both mounts, without Vite's SPA fallback hiding missing assets.
const server = createServer((request, response) => {
  let path = new URL(request.url, 'http://localhost').pathname
  if (path === '/DevPREP') {
    response.writeHead(301, { Location: '/DevPREP/' }).end()
    return
  }
  if (path.startsWith('/DevPREP/')) path = path.slice('/DevPREP'.length)
  if (path === '/') path = '/index.html'
  const file = files.get(path)
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
    return
  }
  response.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-store' })
  response.end(file.body)
})
server.on('error', error => {
  console.error(error)
  process.exit(1)
})
server.listen(Number(process.argv[2]), '127.0.0.1')
