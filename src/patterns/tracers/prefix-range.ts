import { list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Prefix sums: build running totals once, then answer a range in one subtraction. */
export const prefixRange: Tracer = {
  id: 'prefix-range',
  params: [
    { name: 'nums', label: 'Numbers', kind: 'ints' },
    { name: 'lo', label: 'From index (lo)', kind: 'int' },
    { name: 'hi', label: 'To index (hi)', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const nums = parseInts(input.nums)
    const lo = parseOneInt(input.lo, 0, 11)
    const hi = parseOneInt(input.hi, 0, 11)
    if (typeof nums === 'string') errors.nums = nums
    if (typeof lo === 'string') errors.lo = lo
    if (typeof hi === 'string') errors.hi = hi
    if (typeof nums !== 'string' && typeof lo === 'number' && lo >= nums.length) errors.lo = `Use an index from 0 to ${nums.length - 1}.`
    if (typeof nums !== 'string' && typeof hi === 'number' && hi >= nums.length) errors.hi = `Use an index from 0 to ${nums.length - 1}.`
    if (typeof lo === 'number' && typeof hi === 'number' && !errors.lo && !errors.hi && lo > hi) errors.hi = 'hi must be at least lo.'
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [nums, lo, hi] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const lo = args[1] as number
    const hi = args[2] as number
    const prefix = [0]
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, index: number | null, extra: { window?: [number, number]; marked?: number[] } = {}) => frames.push({
      line,
      text,
      vars: { lo, hi, x: index === null ? null : nums[index], 'prefix length': prefix.length },
      view: {
        arrays: [
          { name: 'nums', label: 'nums', values: [...nums], pointers: index === null ? [] : [{ name: 'x', index }], window: extra.window },
          { name: 'prefix', label: 'prefix (prefix[k] = sum of the first k numbers)', values: [...prefix], marked: extra.marked },
        ],
      },
    })
    snap('init', 'Start the running totals with 0: the sum of no numbers.', null)
    for (let index = 0; index < nums.length; index++) {
      snap('loop', `Take the next number, ${nums[index]}.`, index)
      const before = prefix[prefix.length - 1]
      prefix.push(before + nums[index])
      snap('add', `Append ${before} + ${nums[index]} = ${prefix[prefix.length - 1]}.`, index)
    }
    const result = prefix[hi + 1] - prefix[lo]
    snap('answer', `Sum of indexes ${lo} to ${hi} = prefix[${hi + 1}] − prefix[${lo}] = ${prefix[hi + 1]} − ${prefix[lo]} = ${result}.`, null, { window: [lo, hi], marked: [lo, hi + 1] })
    return { frames, result }
  },
  random(rand) {
    const nums = randomInts(rand, 1 + Math.floor(rand() * 10), -20, 20)
    const lo = Math.floor(rand() * nums.length)
    const hi = lo + Math.floor(rand() * (nums.length - lo))
    return { nums: list(nums), lo: String(lo), hi: String(hi) }
  },
}
