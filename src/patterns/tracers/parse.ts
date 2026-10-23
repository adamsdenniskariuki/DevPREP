export const MAX_ITEMS = 12
export const MIN_VALUE = -99
export const MAX_VALUE = 99

/** Parses "3, 1 4" into whole numbers within small limits. Returns an error message when it cannot. */
export function parseInts(text: string | undefined, { min = MIN_VALUE, max = MAX_VALUE, minItems = 1, maxItems = MAX_ITEMS } = {}): number[] | string {
  const parts = (text ?? '').trim().replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)
  if (parts.length < minItems) return minItems === 1 ? 'Enter at least one number.' : `Enter at least ${minItems} numbers.`
  if (parts.length > maxItems) return `Use at most ${maxItems} numbers.`
  const values: number[] = []
  for (const part of parts) {
    if (!/^-?\d+$/.test(part)) return `“${part}” is not a whole number.`
    const value = Number(part)
    if (value < min || value > max) return `Keep numbers between ${min} and ${max}.`
    values.push(value)
  }
  return values
}

export function parseOneInt(text: string | undefined, min = -999, max = 999): number | string {
  const value = (text ?? '').trim()
  if (!value) return 'Enter a number.'
  if (!/^-?\d+$/.test(value)) return `“${value}” is not a whole number.`
  const n = Number(value)
  if (n < min || n > max) return `Keep it between ${min} and ${max}.`
  return n
}

export function randomInts(rand: () => number, length: number, min: number, max: number): number[] {
  return Array.from({ length }, () => min + Math.floor(rand() * (max - min + 1)))
}

export const list = (values: number[]) => values.join(', ')
