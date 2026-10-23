import { heapNodes, list, parseInts, parseOneInt, randomInts } from './parse'
import type { ArrayView, Trace, TraceFrame, Tracer, TreeView } from './types'

/** An array heap that keeps `before(parent, child)` true. It mirrors the push and pop helpers in the shown JavaScript. */
class SimHeap<T> {
  items: T[] = []
  private readonly before: (a: T, b: T) => boolean
  constructor(before: (a: T, b: T) => boolean) { this.before = before }
  get size() { return this.items.length }
  get top() { return this.items[0] }
  push(value: T) {
    const h = this.items
    h.push(value)
    let i = h.length - 1
    while (i > 0 && this.before(h[i], h[(i - 1) >> 1])) {
      const p = (i - 1) >> 1;
      [h[i], h[p]] = [h[p], h[i]]
      i = p
    }
  }
  pop(): T {
    const h = this.items
    const top = h[0]
    const last = h.pop()!
    if (h.length) {
      h[0] = last
      this.down(0)
    }
    return top
  }
  replaceTop(value: T) {
    this.items[0] = value
    this.down(0)
  }
  private down(start: number) {
    const h = this.items
    let i = start
    for (;;) {
      let s = i
      for (const c of [2 * i + 1, 2 * i + 2]) if (c < h.length && this.before(h[c], h[s])) s = c
      if (s === i) return
      ;[h[i], h[s]] = [h[s], h[i]]
      i = s
    }
  }
}

const heapTree = (name: string, label: string, values: readonly (number | string)[], pointers: { name: string; index: number }[] = [], marked: number[] = []): TreeView =>
  ({ name, label, nodes: heapNodes(values), pointers, marked })

const heapArray = (name: string, label: string, values: readonly (number | string)[], pointers: { name: string; index: number }[] = []): ArrayView =>
  ({ name, label, values: [...values], pointers })

const numsParam = { name: 'nums', label: 'Numbers', kind: 'ints' as const }

/** A binary heap: push sifts a value up past bigger parents; pop moves the last value to the root and sifts it down. */
export const heapSort: Tracer = {
  id: 'heap-sort',
  params: [numsParam],
  parse(input) {
    const nums = parseInts(input.nums, { maxItems: 10 })
    return typeof nums === 'string' ? { ok: false, errors: { nums } } : { ok: true, args: [nums] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const heap: number[] = []
    const out: number[] = []
    const frames: TraceFrame[] = []
    let x: number | null = null
    let ptrs: { name: string; index: number }[] = []
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { x, 'heap[0]': heap.length ? heap[0] : null, size: heap.length },
      view: {
        arrays: [heapArray('heap', 'heap as an array (children of i sit at 2i + 1 and 2i + 2)', heap, ptrs), { name: 'out', label: 'out', values: [...out] }],
        trees: [heapTree('tree', 'heap as a tree (every parent ≤ its children)', heap, ptrs)],
      },
    })
    snap('init', 'Start with an empty min-heap.')
    for (const value of nums) {
      x = value
      heap.push(value)
      let i = heap.length - 1
      ptrs = [{ name: 'i', index: i }]
      snap('push', `Append ${value} at the end of the array: the next free leaf.`)
      for (;;) {
        const p = (i - 1) >> 1
        if (i > 0 && heap[p] > heap[i]) {
          ptrs = [{ name: 'i', index: i }, { name: 'parent', index: p }]
          snap('up', `Its parent ${heap[p]} is bigger than ${heap[i]}, which breaks the heap rule.`)
          ;[heap[i], heap[p]] = [heap[p], heap[i]]
          i = p
          ptrs = [{ name: 'i', index: i }]
          snap('swapup', `Swap them. ${heap[i]} moves up one level.`)
        } else {
          snap('up', i === 0 ? `${heap[i]} reached the root, so stop.` : `Its parent ${heap[p]} is not bigger, so the heap rule holds again.`)
          break
        }
      }
    }
    x = null
    ptrs = []
    while (heap.length) {
      snap('pop', `The heap holds ${heap.length} value${heap.length === 1 ? '' : 's'}. The smallest is always at the root.`)
      out.push(heap[0])
      snap('take', `Output the root, ${heap[0]}.`)
      const last = heap.pop()!
      if (!heap.length) break
      heap[0] = last
      let i = 0
      ptrs = [{ name: 'i', index: 0 }]
      snap('move', `Move the last value, ${last}, into the root's place. Now sift it down.`)
      for (;;) {
        let small = i
        for (const c of [2 * i + 1, 2 * i + 2]) if (c < heap.length && heap[c] < heap[small]) small = c
        if (small === i) {
          snap('down', `No child is smaller than ${heap[i]}, so it stays here.`)
          break
        }
        ptrs = [{ name: 'i', index: i }, { name: 'child', index: small }]
        snap('down', `The smaller child, ${heap[small]}, is less than ${heap[i]}.`)
        ;[heap[i], heap[small]] = [heap[small], heap[i]]
        i = small
        ptrs = [{ name: 'i', index: i }]
        snap('swapdown', `Swap them. ${heap[i]} moves down one level.`)
      }
      ptrs = []
    }
    ptrs = []
    snap('done', `The heap is empty. The values came out smallest first: [${out.join(', ')}].`)
    return { frames, result: out }
  },
  random(rand) {
    return { nums: list(randomInts(rand, 1 + Math.floor(rand() * 9), -20, 40)) }
  },
}

/** Top K: a min-heap of size k holds the k largest so far; its root is the one to beat. */
export const topK: Tracer = {
  id: 'top-k',
  params: [numsParam, { name: 'k', label: 'k', kind: 'int' }],
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
    const nums = args[0] as number[]
    const k = args[1] as number
    const heap = new SimHeap<number>((a, b) => a < b)
    const frames: TraceFrame[] = []
    let at = -1
    const snap = (line: string, text: string, marked: number[] = []) => frames.push({
      line,
      text,
      vars: { x: at >= 0 ? nums[at] : null, k, 'heap[0]': heap.size ? heap.top : null },
      view: {
        arrays: [
          { name: 'nums', label: 'nums', values: nums, pointers: at >= 0 ? [{ name: 'x', index: at }] : [] },
          heapArray('heap', `heap (the ${k} largest so far)`, heap.items),
        ],
        trees: [heapTree('tree', 'min-heap as a tree (root = smallest kept)', heap.items, heap.size ? [{ name: 'root', index: 0 }] : [], marked)],
      },
    })
    snap('init', `Start with an empty min-heap. It will hold at most ${k} values.`)
    nums.forEach((x, index) => {
      at = index
      if (heap.size < k) {
        snap('check', `The heap holds ${heap.size}, fewer than ${k}, so ${x} goes straight in.`)
        heap.push(x)
        snap('push', `Push ${x}. The root is now ${heap.top}, the smallest of the kept values.`)
      } else {
        snap('check', `The heap is full with ${k} values.`)
        if (x > heap.top) {
          snap('compare', `${x} beats the root ${heap.top}, the weakest of the top ${k}.`)
          heap.replaceTop(x)
          snap('replace', `Replace the root with ${x} and sift it down. The new root is ${heap.top}.`)
        } else {
          snap('compare', `${x} is not bigger than the root ${heap.top}, so it cannot be in the top ${k}. Skip it.`)
        }
      }
    })
    at = -1
    const result = [...heap.items].sort((a, b) => b - a)
    snap('done', `Every value was seen. The heap holds the top ${k}: [${result.join(', ')}], largest first.`, heap.items.map((_, i) => i))
    return { frames, result }
  },
  random(rand) {
    const nums = randomInts(rand, 1 + Math.floor(rand() * 10), -20, 40)
    return { nums: list(nums), k: String(1 + Math.floor(rand() * nums.length)) }
  },
}

type Entry = [number, number, number]
const entryBefore = (a: Entry, b: Entry) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
const entryLabel = (entry: Entry) => `${entry[0]}·L${entry[1]}`

/** K-way merge: the heap holds one front value per list, so the smallest remaining value is always at the root. */
export const kwayMerge: Tracer = {
  id: 'kway-merge',
  params: [{ name: 'lists', label: 'Sorted lists, separated by |', kind: 'text' }],
  parse(input) {
    const parts = (input.lists ?? '').split('|')
    if (parts.length < 2) return { ok: false, errors: { lists: 'Enter at least 2 lists, separated by |.' } }
    if (parts.length > 4) return { ok: false, errors: { lists: 'Use at most 4 lists.' } }
    const lists: number[][] = []
    for (const [i, part] of parts.entries()) {
      const values = parseInts(part, { min: 0, max: 99, minItems: 0, maxItems: 4 })
      if (typeof values === 'string') return { ok: false, errors: { lists: `List ${i + 1}: ${values.replace('numbers.', 'numbers per list.')}` } }
      if (values.some((value, j) => j > 0 && value < values[j - 1])) return { ok: false, errors: { lists: `List ${i + 1} must be sorted from smallest to largest.` } }
      lists.push(values)
    }
    if (lists.every(values => values.length === 0)) return { ok: false, errors: { lists: 'Enter at least one number.' } }
    return { ok: true, args: [lists] }
  },
  run(args): Trace {
    const lists = args[0] as number[][]
    const heap = new SimHeap<Entry>(entryBefore)
    const out: number[] = []
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, vars: Record<string, number | null> = {}) => frames.push({
      line,
      text,
      vars: { 'heap size': heap.size, ...vars },
      view: {
        arrays: [
          ...lists.map((values, i): ArrayView => {
            const entry = heap.items.find(item => item[1] === i)
            return { name: `L${i}`, label: `L${i}`, values, pointers: entry ? [{ name: 'front', index: entry[2] }] : [], marked: values.map((_, j) => j).filter(j => out.length && (entry ? j < entry[2] : true)) }
          }),
          { name: 'out', label: 'out', values: [...out] },
        ],
        trees: [heapTree('heap', 'heap of list fronts (value·list)', heap.items.map(entryLabel), heap.size ? [{ name: 'min', index: 0 }] : [])],
      },
    })
    lists.forEach((values, i) => { if (values.length) heap.push([values[0], i, 0]) })
    snap('init', `Push the first value of every non-empty list. The heap holds ${heap.size} fronts.`)
    while (heap.size) {
      snap('loop', `The root, ${entryLabel(heap.top)}, is the smallest value left anywhere.`)
      const [val, i, j] = heap.pop()
      snap('pop', `Pop ${val} from list L${i}.`, { val, i, j })
      out.push(val)
      snap('take', `Append ${val} to the output.`, { val, i, j })
      if (j + 1 < lists[i].length) {
        snap('check', `L${i} has another value, ${lists[i][j + 1]}.`, { val, i, j })
        heap.push([lists[i][j + 1], i, j + 1])
        snap('push', `Push ${lists[i][j + 1]} from L${i}. Each list keeps exactly one value in the heap.`, { val, i, j })
      } else {
        snap('check', `L${i} is used up, so nothing replaces it.`, { val, i, j })
      }
    }
    snap('done', `The heap is empty. Return the merged list [${out.join(', ')}].`)
    return { frames, result: out }
  },
  random(rand) {
    const count = 2 + Math.floor(rand() * 3)
    return { lists: Array.from({ length: count }, () => list(randomInts(rand, Math.floor(rand() * 5), 0, 30).sort((a, b) => a - b))).join(' | ') }
  },
}

/** Two heaps: a max-heap holds the lower half and a min-heap the upper half, so the median sits at the tops. */
export const runningMedian: Tracer = {
  id: 'running-median',
  params: [numsParam],
  parse(input) {
    const nums = parseInts(input.nums, { maxItems: 10 })
    return typeof nums === 'string' ? { ok: false, errors: { nums } } : { ok: true, args: [nums] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const low = new SimHeap<number>((a, b) => a > b)
    const high = new SimHeap<number>((a, b) => a < b)
    const medians: number[] = []
    const frames: TraceFrame[] = []
    let at = -1
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { x: at >= 0 ? nums[at] : null, 'low top': low.size ? low.top : null, 'high top': high.size ? high.top : null },
      view: {
        arrays: [
          { name: 'nums', label: 'nums', values: nums, pointers: at >= 0 ? [{ name: 'x', index: at }] : [] },
          { name: 'medians', label: 'medians', values: [...medians] },
        ],
        trees: [
          heapTree('low', 'low: max-heap of the smaller half (root = largest)', low.items, low.size ? [{ name: 'top', index: 0 }] : []),
          heapTree('high', 'high: min-heap of the larger half (root = smallest)', high.items, high.size ? [{ name: 'top', index: 0 }] : []),
        ],
      },
    })
    snap('init', 'low holds the smaller half as a max-heap. high holds the larger half as a min-heap.')
    nums.forEach((x, index) => {
      at = index
      if (!low.size || x <= low.top) {
        const top = low.size ? low.top : null
        low.push(x)
        snap('choose', top === null ? `low is empty, so ${x} goes into low.` : `${x} ≤ ${top}, the top of low, so it belongs in the smaller half.`)
      } else {
        const top = low.top
        high.push(x)
        snap('choose', `${x} > ${top}, the top of low, so it belongs in the larger half.`)
      }
      if (low.size > high.size + 1) {
        const moved = low.pop()
        high.push(moved)
        snap('balance', `low had 2 more than high. Move its top, ${moved}, across to high.`)
      } else if (high.size > low.size) {
        const moved = high.pop()
        low.push(moved)
        snap('balance', `high had more than low. Move its top, ${moved}, across to low.`)
      } else {
        snap('balance', `The sizes are ${low.size} and ${high.size}. That is balanced, so nothing moves.`)
      }
      const median = low.size > high.size ? low.top : (low.top + high.top) / 2
      medians.push(median)
      snap('median', low.size > high.size ? `low has one extra value, so the median is its top: ${median}.` : `The halves are equal, so the median is the average of ${low.top} and ${high.top}: ${median}.`)
    })
    at = -1
    snap('done', `Return the median after each value: [${medians.join(', ')}].`)
    return { frames, result: medians }
  },
  random(rand) {
    return { nums: list(randomInts(rand, 1 + Math.floor(rand() * 9), -20, 40)) }
  },
}
