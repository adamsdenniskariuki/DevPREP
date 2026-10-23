import { chain, list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Greedy: each jump covers a window of reachable indexes; while scanning it, remember the farthest reach and jump only at the window's end. */
export const jumpReach: Tracer = {
  id: 'jump-reach',
  params: [{ name: 'nums', label: 'Longest jump from each index', kind: 'ints' }],
  parse(input) {
    const nums = parseInts(input.nums, { min: 0, max: 9, maxItems: 10 })
    return typeof nums === 'string' ? { ok: false, errors: { nums } } : { ok: true, args: [nums] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const n = nums.length
    const last = n - 1
    let jumps = 0
    let end = 0
    let far = 0
    let start = 0
    const frames: TraceFrame[] = []
    const clamp = (k: number) => Math.min(k, last)
    const snap = (line: string, text: string, i: number | null) => {
      const tags = new Map<number, string[]>()
      const tag = (name: string, index: number) => tags.set(index, [...(tags.get(index) ?? []), name])
      if (i !== null) tag('i', i)
      tag('end', clamp(end))
      tag(far > last ? 'far→' : 'far', clamp(far))
      frames.push({
        line,
        text,
        vars: { i, jumps, end, far },
        view: {
          arrays: [{
            name: 'nums',
            label: `nums (window = indexes reachable with ${jumps} jump${jumps === 1 ? '' : 's'}; far→ = beyond the end)`,
            values: [...nums],
            window: [start, clamp(end)],
            pointers: [...tags].map(([index, names]) => ({ name: names.join(', '), index })),
          }],
        },
      })
    }
    snap('init', `Start at index 0 with 0 jumps. The current window is just index 0, so end = 0.`, null)
    for (let i = 0; i < last; i++) {
      const before = far
      far = Math.max(far, i + nums[i])
      snap('reach', `From index ${i} you can reach ${i + nums[i]}. ${far > before ? `That is the new farthest: far = ${far}.` : `far stays ${far}.`}`, i)
      if (i === end) {
        if (far === i) {
          snap('stuck', `Index ${i} ends the window and nothing reaches past it, so the end cannot be reached. Return -1.`, i)
          return { frames, result: -1 }
        }
        jumps++
        start = end + 1
        end = far
        snap('jump', `Index ${i} ends the window. Every index in it has been checked, so jump once, to cover up to far: jumps = ${jumps}, end = ${end}.`, i)
      }
    }
    snap('done', n === 1 ? 'You already stand on the last index. Return 0.' : `The window now reaches the last index. Return ${jumps}.`, null)
    return { frames, result: jumps }
  },
  random(rand) {
    return { nums: list(randomInts(rand, 1 + Math.floor(rand() * 10), 0, 4)) }
  },
}

const BITS = 6
const binary = (x: number) => Array.from({ length: BITS }, (_, k) => ((x >> (BITS - 1 - k)) & 1))

/** Bit manipulation: x & (x - 1) clears the lowest set bit, so the loop runs once per 1 bit. */
export const countBits: Tracer = {
  id: 'count-bits',
  params: [{ name: 'x', label: 'A number from 0 to 63', kind: 'int' }],
  parse(input) {
    const x = parseOneInt(input.x, 0, 63)
    return typeof x === 'string' ? { ok: false, errors: { x } } : { ok: true, args: [x] }
  },
  run(args): Trace {
    let x = args[0] as number
    let count = 0
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, shown: number, cleared: number | null) => {
      const result = shown & (shown - 1)
      const bit = cleared === null ? null : BITS - 1 - cleared
      frames.push({
        line,
        text,
        vars: { x, count },
        view: {
          arrays: [],
          grids: [{
            name: 'bits',
            label: `x in binary (columns are bit values; dotted = the lowest 1 bit and the bits it borrows from, double border = the bit cleared)`,
            cells: [binary(shown), binary(shown - 1), binary(result)],
            rowLabels: [`x=${shown}`, `x-1=${shown - 1}`, `x&(x-1)=${result}`],
            colLabels: Array.from({ length: BITS }, (_, k) => String(1 << (BITS - 1 - k))),
            ...(bit !== null ? { current: [2, bit] as [number, number], deps: [[0, bit], [1, bit]] as [number, number][] } : {}),
          }],
        },
      })
    }
    snap('init', `x = ${x}, which is ${binary(x).join('')} in binary. count = 0.`, x, null)
    while (x !== 0) {
      const before = x
      const low = Math.log2(x & -x)
      x = x & (x - 1)
      snap('clear', `x − 1 flips the lowest 1 bit (worth ${1 << low}) to 0 and every 0 below it to 1. ANDing with x keeps the higher bits and clears that one: ${before} → ${x}.`, before, low)
      count++
      snap('count', `One 1 bit removed, so count = ${count}.${x === 0 ? ' x is now 0.' : ''}`, x, null)
    }
    snap('done', `No 1 bits are left. Return ${count}.`, x, null)
    return { frames, result: count }
  },
  random(rand) {
    return { x: String(Math.floor(rand() * 64)) }
  },
}

type Op = ['get', number] | ['put', number, number]

function parseOps(text: string | undefined): Op[] | string {
  const parts = (text ?? '').split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return 'Enter at least one operation.'
  if (parts.length > 8) return 'Use at most 8 operations.'
  const ops: Op[] = []
  for (const part of parts) {
    const get = /^get\s+(\d)$/.exec(part)
    const put = /^put\s+(\d)\s+(\d{1,2})$/.exec(part)
    if (get) ops.push(['get', Number(get[1])])
    else if (put) ops.push(['put', Number(put[1]), Number(put[2])])
    else return `“${part}” should look like “get 1” or “put 1 10” (keys 0 to 9, values 0 to 99).`
  }
  return ops
}

/** Design: an LRU cache keeps a map from key to node plus a doubly linked list in recency order, so every operation is O(1). */
export const lruOps: Tracer = {
  id: 'lru-ops',
  params: [
    { name: 'capacity', label: 'Capacity (1 to 3)', kind: 'int' },
    { name: 'ops', label: 'Operations, like put 1 10, get 1', kind: 'text' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const capacity = parseOneInt(input.capacity, 1, 3)
    if (typeof capacity === 'string') errors.capacity = capacity
    const ops = parseOps(input.ops)
    if (typeof ops === 'string') errors.ops = ops
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [capacity, ops] }
  },
  run(args): Trace {
    const capacity = args[0] as number
    const ops = args[1] as Op[]
    const order: [number, number][] = []
    const out: number[] = []
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, key: number | null, op: number | null) => {
      const at = key === null ? -1 : order.findIndex(([k]) => k === key)
      frames.push({
        line,
        text,
        vars: { capacity, op: op === null ? null : ops[op].join(' '), size: order.length },
        view: {
          arrays: [
            { name: 'ops', label: 'ops', values: ops.map(item => item.join(' ')), ...(op !== null ? { pointers: [{ name: 'op', index: op }] } : {}) },
            { name: 'out', label: 'out (get results)', values: [...out] },
          ],
          lists: [{
            name: 'recency',
            label: 'list from head (most recent) to tail (least recent), key:value; ⇄ = prev and next links',
            values: order.map(([k, v]) => `${k}:${v}`),
            next: chain(order.length),
            double: true,
            pointers: order.length ? (order.length === 1 ? [{ name: 'MRU, LRU', index: 0 }] : [{ name: 'MRU', index: 0 }, { name: 'LRU', index: order.length - 1 }]) : [],
            marked: at >= 0 ? [at] : [],
          }],
          map: {
            label: 'where (key → its node)',
            entries: [...order].sort((p, q) => p[0] - q[0]).map(([k, v]) => [String(k), `node ${k}:${v}`]),
            ...(key !== null && at >= 0 ? { highlight: String(key) } : {}),
          },
        },
      })
    }
    snap('init', `An empty cache with room for ${capacity}. head and tail are sentinel nodes, so unlinking never needs a special case.`, null, null)
    ops.forEach((item, index) => {
      const key = item[1]
      const at = order.findIndex(([k]) => k === key)
      if (item[0] === 'get') {
        if (at < 0) {
          out.push(-1)
          snap('miss', `get ${key}: the map has no node for ${key}. Record -1.`, null, index)
          return
        }
        const [entry] = order.splice(at, 1)
        order.unshift(entry)
        out.push(entry[1])
        snap('hit', `get ${key}: the map finds the node at once. Unlink it and move it to the front, as the most recent. Record ${entry[1]}.`, key, index)
        return
      }
      const value = item[2]
      if (at >= 0) order.splice(at, 1)
      order.unshift([key, value])
      snap('put', at >= 0 ? `put ${key} ${value}: ${key} is already cached, so unlink its old node, then add a new one at the front.` : `put ${key} ${value}: add a new node at the front and point the map at it.`, key, index)
      if (order.length > capacity) {
        const [old] = order.splice(order.length - 1, 1)
        snap('evict', `The cache holds ${capacity + 1} items, one too many. The node before tail is the least recent: remove ${old[0]} from the list and the map.`, key, index)
      }
    })
    snap('done', `All operations are done. Return the get results: [${out.join(', ')}].`, null, null)
    return { frames, result: out }
  },
  random(rand) {
    const count = 1 + Math.floor(rand() * 8)
    const ops = Array.from({ length: count }, () => {
      const key = Math.floor(rand() * 4)
      return rand() < 0.5 ? `get ${key}` : `put ${key} ${Math.floor(rand() * 100)}`
    })
    return { capacity: String(1 + Math.floor(rand() * 3)), ops: ops.join(', ') }
  },
}
