import { list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Quickselect: partition once, then keep only the side that holds position k - 1. The pivot is the middle element, so runs are repeatable. */
export const quickselect: Tracer = {
  id: 'quickselect',
  params: [
    { name: 'nums', label: 'Numbers', kind: 'ints' },
    { name: 'k', label: 'k (1 = smallest)', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const nums = parseInts(input.nums)
    const k = parseOneInt(input.k, 1, 12)
    if (typeof nums === 'string') errors.nums = nums
    if (typeof k === 'string') errors.k = k
    else if (typeof nums !== 'string' && k > nums.length) errors.k = `k can be at most ${nums.length}, the number of values.`
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [nums, k] }
  },
  run(args): Trace {
    const a = [...(args[0] as number[])]
    const k = args[1] as number
    const target = k - 1
    const frames: TraceFrame[] = []
    let lo = 0
    let hi = a.length - 1
    let store: number | null = null
    let j: number | null = null
    let pivot: number | null = null
    const snap = (line: string, text: string, marked: number[] = []) => {
      const pointers = [{ name: 'target', index: target }]
      if (store !== null) pointers.push({ name: 'store', index: store })
      if (j !== null) pointers.push({ name: 'j', index: j })
      if (pivot !== null && store === null) pointers.push({ name: 'pivot', index: hi })
      frames.push({
        line,
        text,
        vars: { k, lo, hi, pivot, store, j },
        view: { arrays: [{ name: 'a', label: 'a (window = the part that can still hold the answer)', values: [...a], window: [lo, hi], pointers, marked }] },
      })
    }
    snap('init', `Look for the value that would sit at index ${target} once sorted. Every index is still possible.`)
    for (;;) {
      const mid = (lo + hi) >> 1
      ;[a[mid], a[hi]] = [a[hi], a[mid]]
      pivot = a[hi]
      store = lo
      j = null
      snap('pivot', `Take the middle value, ${pivot}, as the pivot and swap it to the end of the window. store starts at ${lo}.`)
      for (let index = lo; index < hi; index++) {
        j = index
        if (a[index] < pivot) {
          snap('scan', `${a[index]} < ${pivot}, so it belongs on the left.`)
          ;[a[store], a[index]] = [a[index], a[store]]
          store++
          snap('swap', `Swap it to index ${store - 1} and move store to ${store}.`)
        } else {
          snap('scan', `${a[index]} ≥ ${pivot}, so leave it on the right.`)
        }
      }
      j = null
      ;[a[store], a[hi]] = [a[hi], a[store]]
      snap('place', `Swap the pivot into index ${store}. Everything left of it is smaller; nothing right of it is.`, [store])
      if (store === target) {
        const answer = a[store]
        snap('found', `The pivot landed on index ${target}, so it is the answer: ${answer}.`, [store])
        return { frames, result: answer }
      }
      snap('found', `The pivot landed on index ${store}, not ${target}.`, [store])
      if (store < target) {
        lo = store + 1
        store = null
        pivot = null
        snap('right', `Index ${target} is to the right, so drop the left part. The window is now ${lo} to ${hi}.`)
      } else {
        hi = store - 1
        store = null
        pivot = null
        snap('left', `Index ${target} is to the left, so drop the right part. The window is now ${lo} to ${hi}.`)
      }
    }
  },
  random(rand) {
    const nums = randomInts(rand, 1 + Math.floor(rand() * 10), -20, 40)
    return { nums: list(nums), k: String(1 + Math.floor(rand() * nums.length)) }
  },
}
