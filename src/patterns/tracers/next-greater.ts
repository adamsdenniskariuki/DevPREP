import { list, parseInts, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Monotonic stack: keep indexes whose next greater value is still unknown, in falling value order. */
export const nextGreater: Tracer = {
  id: 'next-greater',
  params: [{ name: 'nums', label: 'Numbers', kind: 'ints' }],
  parse(input) {
    const nums = parseInts(input.nums)
    return typeof nums === 'string' ? { ok: false, errors: { nums } } : { ok: true, args: [nums] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const answer = nums.map(() => -1)
    const stack: number[] = []
    const frames: TraceFrame[] = []
    let at: number | null = null
    const snap = (line: string, text: string, filled?: number) => frames.push({
      line,
      text,
      vars: { i: at, 'nums[i]': at === null ? null : nums[at], top: stack.length ? stack[stack.length - 1] : null },
      view: {
        arrays: [
          { name: 'nums', label: 'nums (marked: waiting on the stack)', values: [...nums], pointers: at === null ? [] : [{ name: 'i', index: at }], marked: [...stack] },
          { name: 'stack', label: 'stack of indexes (top is last)', values: [...stack], pointers: stack.length ? [{ name: 'top', index: stack.length - 1 }] : [] },
          { name: 'answer', label: 'answer', values: [...answer], marked: filled === undefined ? [] : [filled] },
        ],
      },
    })
    snap('init', 'Every answer starts as -1. The stack holds indexes still waiting for a greater value.')
    for (let i = 0; i < nums.length; i++) {
      at = i
      snap('loop', `Visit index ${i}, value ${nums[i]}.`)
      while (stack.length && nums[stack[stack.length - 1]] < nums[i]) {
        const top = stack[stack.length - 1]
        snap('check', `The top waits at index ${top} with ${nums[top]}, which is less than ${nums[i]}.`)
        stack.pop()
        answer[top] = nums[i]
        snap('pop', `So ${nums[i]} is the next greater value for index ${top}. Pop it and record ${nums[i]}.`, top)
      }
      snap('check', stack.length ? `The top value ${nums[stack[stack.length - 1]]} is not less than ${nums[i]}, so stop popping.` : 'The stack is empty, so nothing is waiting.')
      stack.push(i)
      snap('push', `Push index ${i}. It now waits for a value greater than ${nums[i]}.`)
    }
    at = null
    snap('done', stack.length ? `Indexes ${stack.join(', ')} never saw a greater value, so they keep -1.` : 'Every index found a greater value.')
    return { frames, result: answer }
  },
  random(rand) {
    return { nums: list(randomInts(rand, 1 + Math.floor(rand() * 9), 0, 20)) }
  },
}
