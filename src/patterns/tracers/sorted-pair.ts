import { list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Two pointers: start at both ends of a sorted list and move the side that fixes the sum. */
export const sortedPair: Tracer = {
  id: 'sorted-pair',
  params: [
    { name: 'nums', label: 'Sorted numbers', kind: 'ints' },
    { name: 'target', label: 'Target sum', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const nums = parseInts(input.nums)
    const target = parseOneInt(input.target, -198, 198)
    if (typeof nums === 'string') errors.nums = nums
    else if (nums.some((value, index) => index > 0 && nums[index - 1] > value)) errors.nums = 'Two pointers needs sorted input. List the numbers from smallest to largest.'
    if (typeof target === 'string') errors.target = target
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [nums, target] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const target = args[1] as number
    const frames: TraceFrame[] = []
    let lo = 0
    let hi = nums.length - 1
    const snap = (line: string, text: string, total: number | null, marked?: number[]) => frames.push({
      line,
      text,
      vars: { target, lo, hi, total },
      view: {
        arrays: [{
          name: 'nums',
          label: 'nums (sorted)',
          values: [...nums],
          pointers: lo <= hi ? [{ name: 'lo', index: lo }, { name: 'hi', index: hi }] : [],
          window: lo <= hi ? [lo, hi] : undefined,
          marked,
        }],
      },
    })
    snap('init', `Put lo at the smallest number and hi at the largest. Target: ${target}.`, null)
    while (lo < hi) {
      snap('loop', `lo (${lo}) is left of hi (${hi}), so keep going.`, null)
      const total = nums[lo] + nums[hi]
      snap('sum', `${nums[lo]} + ${nums[hi]} = ${total}.`, total)
      if (total === target) {
        snap('found', `${total} equals the target, so return [${lo}, ${hi}].`, total, [lo, hi])
        return { frames, result: [lo, hi] }
      }
      if (total < target) {
        lo++
        snap('left', `${total} is too small. Only a bigger left number can help, so move lo right to ${lo}.`, total)
      } else {
        hi--
        snap('right', `${total} is too big. Only a smaller right number can help, so move hi left to ${hi}.`, total)
      }
    }
    snap('none', 'The pointers met without finding the target, so return an empty list.', null)
    return { frames, result: [] }
  },
  random(rand) {
    const nums = randomInts(rand, 1 + Math.floor(rand() * 9), -15, 15).sort((a, b) => a - b)
    return { nums: list(nums), target: String(-20 + Math.floor(rand() * 41)) }
  },
}
