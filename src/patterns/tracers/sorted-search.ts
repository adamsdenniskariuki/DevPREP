import { list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Binary search: halve the range that can still hold the target. */
export const sortedSearch: Tracer = {
  id: 'sorted-search',
  params: [
    { name: 'nums', label: 'Sorted numbers', kind: 'ints' },
    { name: 'target', label: 'Target', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const nums = parseInts(input.nums)
    const target = parseOneInt(input.target, -99, 99)
    if (typeof nums === 'string') errors.nums = nums
    else if (nums.some((value, index) => index > 0 && nums[index - 1] >= value)) errors.nums = 'Binary search needs sorted input. List different numbers from smallest to largest.'
    if (typeof target === 'string') errors.target = target
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [nums, target] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const target = args[1] as number
    const frames: TraceFrame[] = []
    let lo = 0
    let hi = nums.length - 1
    let mid: number | null = null
    const snap = (line: string, text: string, marked?: number[]) => frames.push({
      line,
      text,
      vars: { target, lo, hi, mid },
      view: {
        arrays: [{
          name: 'nums',
          label: 'nums (window: still possible)',
          values: [...nums],
          pointers: [...(lo <= hi ? [{ name: 'lo', index: lo }, { name: 'hi', index: hi }] : []), ...(mid === null ? [] : [{ name: 'mid', index: mid }])],
          window: lo <= hi ? [lo, hi] : undefined,
          marked,
        }],
      },
    })
    snap('init', `The target ${target} could be anywhere from index 0 to ${hi}.`)
    while (lo <= hi) {
      mid = null
      snap('loop', `lo (${lo}) ≤ hi (${hi}), so there are ${hi - lo + 1} places left to check.`)
      mid = Math.floor((lo + hi) / 2)
      snap('mid', `Check the middle: index ${mid} holds ${nums[mid]}.`)
      if (nums[mid] === target) {
        snap('found', `${nums[mid]} is the target. Return ${mid}.`, [mid])
        return { frames, result: mid }
      }
      if (nums[mid] < target) {
        lo = mid + 1
        snap('right', `${nums[mid]} < ${target}, so the target can only be to the right. Move lo to ${lo}.`)
      } else {
        hi = mid - 1
        snap('left', `${nums[mid]} > ${target}, so the target can only be to the left. Move hi to ${hi}.`)
      }
    }
    mid = null
    snap('none', 'The window is empty, so the target is not in the list. Return -1.')
    return { frames, result: -1 }
  },
  random(rand) {
    const values = [...new Set(randomInts(rand, 1 + Math.floor(rand() * 11), -30, 30))].sort((a, b) => a - b)
    const target = rand() < 0.6 ? values[Math.floor(rand() * values.length)] : -30 + Math.floor(rand() * 61)
    return { nums: list(values), target: String(target) }
  },
}
