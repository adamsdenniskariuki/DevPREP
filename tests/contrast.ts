import type { Locator } from '@playwright/test'

export type Color = [number, number, number, number]

export function color(value: string): Color {
  if (value === 'transparent') return [0, 0, 0, 0]
  if (/^#[\da-f]{6}$/i.test(value)) {
    return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16), 1]
  }
  const match = value.match(/^rgba?\(([\d.,\s]+)\)$/)
  if (!match) throw new Error(`Unsupported color in contrast check: ${value}`)
  const parts = match[1].split(',').map(Number)
  return [parts[0], parts[1], parts[2], parts[3] ?? 1]
}

export function over(foreground: Color, background: Color): Color {
  return [
    foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
    foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
    foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
    1,
  ]
}

function luminance(value: Color) {
  return value.slice(0, 3).map(channel => {
    const s = channel / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

export function contrast(first: Color, second: Color) {
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export function css(value: string) {
  const [r, g, b] = color(value)
  return `rgb(${r}, ${g}, ${b})`
}

export async function textContrast(locator: Locator) {
  const styles = await locator.evaluate(element => {
    const backgrounds: string[] = []
    let current: Element | null = element
    while (current) {
      backgrounds.push(getComputedStyle(current).backgroundColor)
      current = current.parentElement
    }
    return { foreground: getComputedStyle(element).color, backgrounds }
  })
  const background = styles.backgrounds.reverse().reduce((base, layer) => over(color(layer), base), [255, 255, 255, 1] as Color)
  return contrast(over(color(styles.foreground), background), background)
}
