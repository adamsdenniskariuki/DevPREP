import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

const directory = new URL('../public/icons/', import.meta.url)
const purple = [107, 54, 168]
const icons = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
] as const

function paeth(left: number, up: number, upperLeft: number) {
  const prediction = left + up - upperLeft
  const a = Math.abs(prediction - left)
  const b = Math.abs(prediction - up)
  const c = Math.abs(prediction - upperLeft)
  return a <= b && a <= c ? left : b <= c ? up : upperLeft
}

// Decode Chromium's non-interlaced RGB/RGBA PNGs without an image dependency.
function decodePng(png: Buffer) {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  expect(png.toString('ascii', 12, 16)).toBe('IHDR')
  expect(png.readUInt32BE(8)).toBe(13)
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  expect(png[24]).toBe(8)
  expect([2, 6]).toContain(png[25])
  expect([...png.subarray(26, 29)]).toEqual([0, 0, 0])
  const channels = png[25] === 6 ? 4 : 3
  const data: Buffer[] = []
  let ended = false
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    expect(offset + length + 12).toBeLessThanOrEqual(png.length)
    if (type === 'IDAT') data.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
    if (type === 'IEND') {
      expect(length).toBe(0)
      expect(offset).toBe(png.length)
      ended = true
      break
    }
  }
  expect(ended).toBe(true)
  const packed = inflateSync(Buffer.concat(data))
  const stride = width * channels
  expect(packed.length).toBe((stride + 1) * height)
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)]
    expect(filter).toBeLessThanOrEqual(4)
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x
      const left = x >= channels ? pixels[index - channels] : 0
      const up = y > 0 ? pixels[index - stride] : 0
      const upperLeft = y > 0 && x >= channels ? pixels[index - stride - channels] : 0
      const predictors = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)]
      pixels[index] = (packed[y * (stride + 1) + x + 1] + predictors[filter]) & 255
    }
  }
  return { width, height, channels, pixels }
}

describe('original DevPREP install icons', () => {
  it.each(icons)('%s has real PNG bytes, expected dimensions, and an opaque, safe original mark', (name, size) => {
    const { width, height, channels, pixels } = decodePng(readFileSync(new URL(name, directory)))
    expect([width, height]).toEqual([size, size])
    let nonOpaque = 0
    let outsideSafeZone = 0
    let unexpectedColor = 0
    const whiteByRegion = [0, 0, 0]
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels
        if (channels === 4 && pixels[offset + 3] !== 255) nonOpaque++
        const rgb = [...pixels.subarray(offset, offset + 3)]
        const background = rgb.every((value, channel) => value === purple[channel])
        if (!background && Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size * 0.4) {
          outsideSafeZone++
        }
        // Every raster pixel is either fixed purple, white, or their antialiased blend.
        const blends = rgb.map((value, channel) => (value - purple[channel]) / (255 - purple[channel]))
        if (Math.min(...blends) < 0 || Math.max(...blends) - Math.min(...blends) > 0.02) {
          unexpectedColor++
        }
        if (rgb.every(value => value === 255)) {
          const region = x < size * 0.4 ? 0 : x > size * 0.6 ? 2 : 1
          whiteByRegion[region]++
        }
      }
    }
    expect(nonOpaque).toBe(0)
    expect(outsideSafeZone).toBe(0)
    expect(unexpectedColor).toBe(0)
    // Prevent blank, missing-bracket, or missing-check assets at every output size.
    for (const white of whiteByRegion) expect(white).toBeGreaterThan(size * size * 0.005)
  })

  it('keeps the SVG background explicit and every essential stroke inside the maskable safe circle', () => {
    const svg = readFileSync(new URL('icon.svg', directory), 'utf8')
    expect(svg).toContain('viewBox="0 0 512 512"')
    expect(svg).toContain('<rect width="512" height="512" fill="#6b36a8"/>')
    expect(svg).toContain('stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"')
    expect(svg).not.toMatch(/<image|<text|<use|<script|<foreignObject|href=|style=|transform=|var\(/i)
    const paths = [...svg.matchAll(/<path d="([^"]+)"([^>]*)\/>/g)]
    expect(paths).toHaveLength(3)
    for (const [, path, attributes] of paths) {
      expect(path).toMatch(/^[ML\d.\s]+$/)
      const points = path.match(/\d+(?:\.\d+)?/g)!.map(Number)
      const stroke = Number(attributes.match(/stroke-width="(\d+)"/)?.[1] ?? 28)
      expect(points.length % 2).toBe(0)
      for (let i = 0; i < points.length; i += 2) {
        // Straight segments and round caps/joins stay within this convex bound.
        expect(Math.hypot(points[i] - 256, points[i + 1] - 256) + stroke / 2).toBeLessThan(204.8)
      }
    }
  })
})
