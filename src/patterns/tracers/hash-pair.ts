import { list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Arrays & hashing: one pass, remembering what we have seen in a map. */
export const hashPair: Tracer = {
  id: 'hash-pair',
  params: [
    { name: 'nums', label: 'Numbers', kind: 'ints' },
    { name: 'target', label: 'Target sum', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const nums = parseInts(input.nums)
    const target = parseOneInt(input.target, -198, 198)
    if (typeof nums === 'string') errors.nums = nums
    if (typeof target === 'string') errors.target = target
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [nums, target] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const target = args[1] as number
    const seen = new Map<number, number>()
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, i: number | null, need: number | null, highlight?: number, marked?: number[]) => frames.push({
      line,
      text,
      vars: { target, i, 'nums[i]': i === null ? null : nums[i], need },
      view: {
        arrays: [{ name: 'nums', label: 'nums', values: [...nums], pointers: i === null ? [] : [{ name: 'i', index: i }], marked }],
        map: { label: 'seen (value → index)', entries: [...seen].map(([key, value]) => [String(key), String(value)]), highlight: highlight === undefined ? undefined : String(highlight) },
      },
    })
    snap('init', `Start with an empty map. We want two numbers that add up to ${target}.`, null, null)
    for (let i = 0; i < nums.length; i++) {
      snap('loop', `Look at index ${i}, value ${nums[i]}.`, i, null)
      const need = target - nums[i]
      snap('need', `It needs a partner of ${target} − ${nums[i]} = ${need}.`, i, need)
      if (seen.has(need)) {
        const j = seen.get(need)!
        snap('found', `${need} is in the map at index ${j}, so return [${j}, ${i}].`, i, need, need, [j, i])
        return { frames, result: [j, i] }
      }
      seen.set(nums[i], i)
      snap('store', `${need} is not in the map yet. Remember ${nums[i]} at index ${i}.`, i, need, nums[i])
    }
    snap('none', 'No pair adds up to the target, so return an empty list.', null, null)
    return { frames, result: [] }
  },
  random(rand) {
    const nums = randomInts(rand, 1 + Math.floor(rand() * 8), -9, 9)
    return { nums: list(nums), target: String(-10 + Math.floor(rand() * 21)) }
  },
}
