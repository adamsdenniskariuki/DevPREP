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
import { EXCALIDRAW_VERSION } from './src/excalidraw-version'
import { libClosure } from './src/runner/ts-core'
import { readdirSync, readFileSync } from 'node:fs'

let outputDirectory = resolve('dist')

// The app version is the newest entry in content/changelog.json (validated against package.json by npm run content).
// DEVPREP_VERSION overrides it, e.g. for the PWA tests' second build; the date is that release's, so builds stay reproducible.
const releases: { version: string; date: string }[] = JSON.parse(readFileSync(resolve('content/changelog.json'), 'utf8')).releases
const APP_VERSION = process.env.DEVPREP_VERSION ?? releases[0].version
const APP_DATE = releases.find(release => release.version === APP_VERSION)?.date ?? new Date().toISOString().slice(0, 10)

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

// Excalidraw's fonts are self-hosted at excalidraw/<version>/fonts/ (window.EXCALIDRAW_ASSET_PATH) instead of
// its CDN. The Latin families are precached; the large CJK family (Xiaolai) is cached at runtime if ever used.
const EXCALIDRAW_FONTS = resolve('node_modules/@excalidraw/excalidraw/dist/prod/fonts')
function excalidrawFonts() {
  return readdirSync(EXCALIDRAW_FONTS, { recursive: true, encoding: 'utf8' }).map(name => name.replaceAll('\\', '/')).filter(name => name.endsWith('.woff2'))
}
function excalidrawAssets(): Plugin {
  const prefix = `excalidraw/${EXCALIDRAW_VERSION}/fonts/`
  return {
    name: 'devprep-excalidraw-assets',
    configureServer(server) {
      const files = new Set(excalidrawFonts())
      server.middlewares.use((request, response, next) => {
        const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
        const at = path.indexOf(`/${prefix}`)
        const name = at >= 0 ? path.slice(at + prefix.length + 1) : ''
        if (!files.has(name)) return next()
        response.setHeader('Content-Type', 'font/woff2')
        createReadStream(resolve(EXCALIDRAW_FONTS, name)).pipe(response)
      })
    },
    async generateBundle() {
      for (const name of excalidrawFonts()) this.emitFile({ type: 'asset', fileName: `${prefix}${name}`, source: await readFile(resolve(EXCALIDRAW_FONTS, name)) })
    },
  }
}

// Excalidraw lazily imports optional extras (Mermaid text-to-diagram, ~50 UI translations, image tools) that a board
// never needs to open or draw. They load online when used but are left out of the precache, which would otherwise
// nearly double. Everything reachable from the app, and everything Excalidraw imports statically, is precached.
const runtimeOnlyChunks = new Set<string>()
function excalidrawExtras(): Plugin {
  return {
    name: 'devprep-excalidraw-extras',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = new Map(Object.values(bundle).flatMap(item => item.type === 'chunk' ? [[item.fileName, item] as const] : []))
      const fromExcalidraw = (fileName: string) => chunks.get(fileName)!.moduleIds.some(id => id.replaceAll('\\', '/').includes('/node_modules/@excalidraw/'))
      const needed = new Set<string>()
      const visit = (fileName: string) => {
        if (needed.has(fileName) || !chunks.has(fileName)) return
        needed.add(fileName)
        const chunk = chunks.get(fileName)!
        chunk.imports.forEach(visit)
        if (!fromExcalidraw(fileName)) chunk.dynamicImports.forEach(visit)
      }
      for (const chunk of chunks.values()) if (chunk.isEntry) visit(chunk.fileName)
      runtimeOnlyChunks.clear()
      for (const fileName of chunks.keys()) if (!needed.has(fileName)) runtimeOnlyChunks.add(fileName)
      // Lists the online-only chunks so the PWA tests can tell them apart from files that must be precached.
      this.emitFile({ type: 'asset', fileName: `excalidraw/${EXCALIDRAW_VERSION}/online-only.json`, source: JSON.stringify([...runtimeOnlyChunks].sort()) })
    },
  }
}

export default defineConfig({
  base: './',
  define: {
    __APP_RELEASE__: JSON.stringify(process.env.DEVPREP_RELEASE ?? process.env.GITHUB_SHA?.slice(0, 12) ?? 'local'),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_DATE__: JSON.stringify(APP_DATE),
  },
  plugins: [
    react(),
    pyodideAssets(),
    typescriptAssets(),
    pgliteAssets(),
    excalidrawAssets(),
    excalidrawExtras(),
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
        globIgnores: ['**/sw.js', '**/sw.js.map', '**/pyodide/**', '**/typescript/**', '**/pglite/**', '**/excalidraw/*/fonts/Xiaolai/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        rollupFormat: 'iife',
        manifestTransforms: [async entries => ({
          manifest: await Promise.all(entries.filter(entry => !runtimeOnlyChunks.has(entry.url)).map(async entry => ({
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
        // Names the lazy Excalidraw chunk after BoardCanvas (Rollup would otherwise name it after an Excalidraw module).
        chunkFileNames: chunk => chunk.moduleIds.some(id => id.replaceAll('\\', '/').endsWith('/src/components/BoardCanvas.tsx')) ? 'assets/BoardCanvas-[hash].js' : 'assets/[name]-[hash].js',
        manualChunks(id) {
          const path = id.replaceAll('\\', '/')
          if (path.endsWith('/src/generated/problems.json')) return 'problems'
          if (path.endsWith('/src/generated/nav-index.json')) return 'nav-index'
          if (path.endsWith('/src/generated/changelog.json')) return 'changelog'
          if ((path.includes('/content/') || path.includes('/src/generated/')) && path.endsWith('.json')) return 'curriculum'
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
