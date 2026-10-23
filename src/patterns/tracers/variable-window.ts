import { list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Sliding window: grow on the right, shrink on the left while the window breaks the rule. */
export const variableWindow: Tracer = {
  id: 'variable-window',
  params: [
    { name: 'nums', label: 'Non-negative numbers', kind: 'ints' },
    { name: 'limit', label: 'Sum limit', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const nums = parseInts(input.nums, { min: 0 })
    const limit = parseOneInt(input.limit, 0, 999)
    if (typeof nums === 'string') errors.nums = nums
    if (typeof limit === 'string') errors.limit = limit
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [nums, limit] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const limit = args[1] as number
    const frames: TraceFrame[] = []
    let left = 0
    let total = 0
    let best = 0
    let right: number | null = null
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { limit, left, right, total, best },
      view: {
        arrays: [{
          name: 'nums',
          label: 'nums',
          values: [...nums],
          pointers: right === null ? [{ name: 'left', index: left }] : [{ name: 'left', index: left }, { name: 'right', index: right }],
          window: right !== null && left <= right ? [left, right] : undefined,
        }],
      },
    })
    snap('init', `Start with an empty window. Its sum must stay at most ${limit}.`)
    for (right = 0; right < nums.length; right++) {
      snap('grow', `Move right to index ${right}.`)
      total += nums[right]
      snap('add', `Add ${nums[right]}: the window sum is now ${total}.`)
      while (total > limit) {
        snap('check', `${total} is over the limit of ${limit}, so the window must shrink.`)
        total -= nums[left]
        left++
        snap('shrink', `Drop ${nums[left - 1]} from the left. left is now ${left}, sum ${total}.`)
      }
      const size = right - left + 1
      const previous = best
      best = Math.max(best, size)
      snap('best', size > previous ? `The window has ${size} numbers, a new best.` : `The window has ${size} numbers. Best stays ${best}.`)
    }
    right = null
    snap('done', `Every window was checked. The longest has ${best} numbers.`)
    return { frames, result: best }
  },
  random(rand) {
    const nums = randomInts(rand, Math.floor(rand() * 10) + 1, 0, 12)
    return { nums: list(nums), limit: String(Math.floor(rand() * 30)) }
  },
}
