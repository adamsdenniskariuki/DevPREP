import { list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

const MAX_PILE = 15
const MAX_PILES = 8

/** Search on the answer: binary search the smallest speed that passes a yes/no check. */
export const minSpeed: Tracer = {
  id: 'min-speed',
  params: [
    { name: 'piles', label: 'Pile sizes', kind: 'ints' },
    { name: 'hours', label: 'Hours available', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const piles = parseInts(input.piles, { min: 1, max: MAX_PILE, maxItems: MAX_PILES })
    const hours = parseOneInt(input.hours, 1, 40)
    if (typeof piles === 'string') errors.piles = piles
    if (typeof hours === 'string') errors.hours = hours
    else if (typeof piles !== 'string' && hours < piles.length) errors.hours = `You need at least ${piles.length} hours: one per pile, even at top speed.`
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [piles, hours] }
  },
  run(args): Trace {
    const piles = args[0] as number[]
    const hours = args[1] as number
    const top = Math.max(...piles)
    const speeds = Array.from({ length: top }, (_, i) => i + 1)
    const frames: TraceFrame[] = []
    let lo = 1
    let hi = top
    let mid: number | null = null
    let need: number | null = null
    const snap = (line: string, text: string, marked?: number[]) => frames.push({
      line,
      text,
      vars: { hours, lo, hi, mid, need },
      view: {
        arrays: [
          { name: 'piles', label: 'piles', values: [...piles] },
          {
            name: 'speeds',
            label: 'candidate speeds (window: still possible)',
            values: speeds,
            pointers: [{ name: 'lo', index: lo - 1 }, { name: 'hi', index: hi - 1 }, ...(mid === null ? [] : [{ name: 'mid', index: mid - 1 }])],
            window: [lo - 1, hi - 1],
            marked,
          },
        ],
      },
    })
    snap('init', `The answer is a speed from 1 to ${top}, the biggest pile. Any faster is never needed.`)
    while (lo < hi) {
      mid = null
      need = null
      snap('loop', `lo (${lo}) < hi (${hi}), so more than one speed is still possible.`)
      mid = Math.floor((lo + hi) / 2)
      snap('mid', `Try the middle speed, ${mid} per hour.`)
      need = piles.reduce((sum, pile) => sum + Math.ceil(pile / mid!), 0)
      snap('need', `At speed ${mid}, the piles take ${piles.map(pile => Math.ceil(pile / mid!)).join(' + ')} = ${need} hours.`)
      if (need <= hours) {
        hi = mid
        snap('fits', `${need} ≤ ${hours} hours, so ${mid} works. A slower speed might too, so move hi to ${mid}.`)
      } else {
        lo = mid + 1
        snap('slow', `${need} > ${hours} hours, so ${mid} is too slow, and so is anything slower. Move lo to ${lo}.`)
      }
    }
    mid = null
    snap('done', `lo and hi meet at ${lo}: the smallest speed that finishes in ${hours} hours.`, [lo - 1])
    return { frames, result: lo }
  },
  random(rand) {
    const piles = randomInts(rand, 1 + Math.floor(rand() * 6), 1, MAX_PILE)
    const hours = piles.length + Math.floor(rand() * (piles.reduce((a, b) => a + b, 0) - piles.length + 1))
    return { piles: list(piles), hours: String(Math.min(40, hours)) }
  },
}
