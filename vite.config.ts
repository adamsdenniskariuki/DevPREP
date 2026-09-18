import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

let outputDirectory = resolve('dist')

export default defineConfig({
  base: './',
  define: {
    __APP_RELEASE__: JSON.stringify(process.env.DEVPREP_RELEASE ?? process.env.GITHUB_SHA?.slice(0, 12) ?? 'local'),
  },
  plugins: [
    react(),
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
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        globIgnores: ['**/sw.js', '**/sw.js.map'],
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.replaceAll('\\', '/').includes('/src/content/')) return 'curriculum'
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
