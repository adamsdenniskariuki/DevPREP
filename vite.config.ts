import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { PYODIDE_VERSION } from './src/runner/pyodide-version'
import { TYPESCRIPT_VERSION } from './src/runner/ts-version'
import { PGLITE_VERSION } from './src/runner/pglite-version'
import { libClosure } from './src/runner/ts-core'
import { readdirSync, readFileSync } from 'node:fs'

let outputDirectory = resolve('dist')

// Pyodide runtime files are served from pyodide/<version>/ (fetched lazily by the Python worker
// and cached at runtime by the service worker, not precached).
const PYODIDE_FILES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']
const PYODIDE_TYPES: Record<string, string> = { mjs: 'text/javascript', wasm: 'application/wasm', zip: 'application/zip', json: 'application/json' }
function pyodideAssets(): Plugin {
  const prefix = `pyodide/${PYODIDE_VERSION}/`
  return {
    name: 'devprep-pyodide-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname
        const at = path.indexOf(`/${prefix}`)
        const name = at >= 0 ? path.slice(at + prefix.length + 1) : ''
        if (!PYODIDE_FILES.includes(name)) return next()
        response.setHeader('Content-Type', PYODIDE_TYPES[name.split('.').pop()!])
        createReadStream(resolve('node_modules/pyodide', name)).pipe(response)
      })
    },
    async generateBundle() {
      for (const name of PYODIDE_FILES) {
        this.emitFile({ type: 'asset', fileName: `${prefix}${name}`, source: await readFile(resolve('node_modules/pyodide', name)) })
      }
    },
  }
}

// The TypeScript compiler (~9 MB) and its ES lib declarations are served from typescript/<version>/,
// fetched lazily by the TypeScript lab worker and cached at runtime by the service worker.
function typescriptLibs() {
  const read = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
  return JSON.stringify(Object.fromEntries(libClosure(read).map(name => [name, read(name)])))
}
function typescriptAssets(): Plugin {
  const prefix = `typescript/${TYPESCRIPT_VERSION}/`
  let libs: string | undefined
  return {
    name: 'devprep-typescript-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname
        const at = path.indexOf(`/${prefix}`)
        const name = at >= 0 ? path.slice(at + prefix.length + 1) : ''
        if (name === 'typescript.js') {
          response.setHeader('Content-Type', 'text/javascript')
          createReadStream(resolve('node_modules/typescript/lib/typescript.js')).pipe(response)
        } else if (name === 'libs.json') {
          response.setHeader('Content-Type', 'application/json')
          response.end(libs ??= typescriptLibs())
        } else next()
      })
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: `${prefix}typescript.js`, source: await readFile(resolve('node_modules/typescript/lib/typescript.js')) })
      this.emitFile({ type: 'asset', fileName: `${prefix}libs.json`, source: typescriptLibs() })
    },
  }
}

// Postgres (PGlite) is served unbundled from pglite/<version>/ so its loader finds pglite.wasm and pglite.data
// next to index.js. The SQL lab worker imports it on first use; the service worker caches it at runtime.
const PGLITE_DIST = resolve('node_modules/@electric-sql/pglite/dist')
const PGLITE_TYPES: Record<string, string> = { js: 'text/javascript', wasm: 'application/wasm', data: 'application/octet-stream' }
function pgliteFiles() {
  const top = readdirSync(PGLITE_DIST).filter(name => name === 'index.js' || /^chunk-\w+\.js$/.test(name) || ['pglite.wasm', 'pglite.data', 'initdb.wasm'].includes(name))
  return [...top, ...readdirSync(resolve(PGLITE_DIST, 'fs')).filter(name => name.endsWith('.js')).map(name => `fs/${name}`)]
}
function pgliteAssets(): Plugin {
  const prefix = `pglite/${PGLITE_VERSION}/`
  return {
    name: 'devprep-pglite-assets',
    configureServer(server) {
      const files = new Set(pgliteFiles())
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname
        const at = path.indexOf(`/${prefix}`)
        const name = at >= 0 ? path.slice(at + prefix.length + 1) : ''
        if (!files.has(name)) return next()
        response.setHeader('Content-Type', PGLITE_TYPES[name.split('.').pop()!])
        createReadStream(resolve(PGLITE_DIST, name)).pipe(response)
      })
    },
    async generateBundle() {
      for (const name of pgliteFiles()) this.emitFile({ type: 'asset', fileName: `${prefix}${name}`, source: await readFile(resolve(PGLITE_DIST, name)) })
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    __APP_RELEASE__: JSON.stringify(process.env.DEVPREP_RELEASE ?? process.env.GITHUB_SHA?.slice(0, 12) ?? 'local'),
  },
  plugins: [
    react(),
    pyodideAssets(),
    typescriptAssets(),
    pgliteAssets(),
    { name: 'devprep-output-directory', configResolved(config) { outputDirectory = resolve(config.root, config.build.outDir) } },
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'prompt',
      manifest: {
        id: './',
        name: 'DevPREP',
        short_name: 'DevPREP',
        description: 'Guided interview preparation with offline lessons, practice, and reviews.',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#f7f4ef',
        background_color: '#f7f4ef',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}'],
        globIgnores: ['**/sw.js', '**/sw.js.map', '**/pyodide/**', '**/typescript/**', '**/pglite/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        rollupFormat: 'iife',
        manifestTransforms: [async entries => ({
          manifest: await Promise.all(entries.map(async entry => ({
            ...entry,
            revision: createHash('sha256').update(await readFile(resolve(outputDirectory, entry.url))).digest('hex'),
          }))),
          warnings: [],
        })],
      },
    }),
  ],
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll('\\', '/')
          if (path.endsWith('/src/generated/problems.json')) return 'problems'
          if ((path.includes('/content/') || path.includes('/src/generated/')) && path.endsWith('.json')) return 'curriculum'
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
