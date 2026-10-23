import { list, parseInts, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Cyclic sort: values 1..n each belong at index value − 1, so swap each one home, then scan for gaps. */
export const cyclicMissing: Tracer = {
  id: 'cyclic-missing',
  params: [{ name: 'nums', label: 'Numbers from 1 to n', kind: 'ints' }],
  parse(input) {
    const nums = parseInts(input.nums, { min: 1, max: 12 })
    if (typeof nums === 'string') return { ok: false, errors: { nums } }
    if (nums.some(value => value > nums.length)) return { ok: false, errors: { nums: `With ${nums.length} numbers, each must be between 1 and ${nums.length}.` } }
    return { ok: true, args: [nums] }
  },
  run(args): Trace {
    const nums = [...(args[0] as number[])]
    const frames: TraceFrame[] = []
    const missing: number[] = []
    let pos = 0
    let i: number | null = 0
    let want: number | null = null
    let k: number | null = null
    const home = () => nums.flatMap((value, index) => value === index + 1 ? [index] : [])
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { i, 'nums[i]': i === null ? null : nums[i], want, k },
      view: {
        arrays: [
          {
            name: 'nums',
            label: 'nums (marked: value is at its home index)',
            values: [...nums],
            pointers: [...(i === null ? [] : [{ name: 'i', index: i }]), ...(want === null || want === i ? [] : [{ name: 'want', index: want }]), ...(k === null ? [] : [{ name: 'k', index: k }])],
            marked: home(),
          },
          { name: 'missing', label: 'missing', values: [...missing] },
        ],
      },
    })
    snap('init', `Value v belongs at index v − 1. Start at index 0 and send each value home.`)
    while (pos < nums.length) {
      i = pos
      want = nums[pos] - 1
      snap('want', `${nums[pos]} belongs at index ${want}.`)
      if (nums[want] !== nums[pos]) {
        const [a, b] = [nums[pos], nums[want]]
        ;[nums[pos], nums[want]] = [nums[want], nums[pos]]
        snap('swap', `Index ${want} holds ${b}, not ${a}. Swap them, so ${a} is home. Stay at index ${pos} to place ${b}.`)
      } else {
        snap('next', want === pos ? `${nums[pos]} is already home. Move on.` : `Index ${want} already holds a ${nums[pos]}, so this one is a duplicate. Leave it and move on.`)
        pos++
      }
      want = null
    }
    i = null
    snap('scan', 'Every value is home or is a duplicate sitting in a gap. Scan for gaps.')
    for (k = 0; k < nums.length; k++) {
      if (nums[k] !== k + 1) missing.push(k + 1)
      snap('check', nums[k] === k + 1 ? `Index ${k} holds ${k + 1}. Not missing.` : `Index ${k} holds ${nums[k]}, not ${k + 1}, so ${k + 1} is missing.`)
    }
    k = null
    snap('done', missing.length ? `Return the missing numbers: ${missing.join(', ')}.` : 'Nothing is missing. Return an empty list.')
    return { frames, result: missing }
  },
  random(rand) {
    const n = 1 + Math.floor(rand() * 9)
    return { nums: list(randomInts(rand, n, 1, n)) }
  },
}
