import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Run explicitly with `node scripts/generate-pwa-icons.mjs`; checked-in PNGs
// are source assets, not build outputs. Keep the install identity accent-independent.
const directory = new URL('../public/icons/', import.meta.url)
const svg = await readFile(new URL('icon.svg', directory), 'utf8')
const icons = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]

const browser = await chromium.launch()
try {
  for (const [name, size] of icons) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    await page.setContent(`<!doctype html>
      <html><head><meta charset="utf-8"><style>
        html, body { margin: 0; width: 100%; height: 100%; background: #6b36a8; }
        svg { display: block; width: 100%; height: 100%; }
      </style></head><body>${svg}</body></html>`)
    await page.screenshot({
      path: fileURLToPath(new URL(name, directory)),
      type: 'png',
      omitBackground: false,
      animations: 'disabled',
    })
    await page.close()
    console.log(`Generated ${name} (${size} × ${size})`)
  }
} finally {
  await browser.close()
}
