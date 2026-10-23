import { chain, fromLinked, list, parseInts, parseOneInt, randomInts, toLinked } from './parse'
import type { ListNode } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

/** Linked lists: a dummy node before the head means removing the first node needs no special case. */
export const dropValue: Tracer = {
  id: 'drop-value',
  params: [
    { name: 'values', label: 'List values', kind: 'ints' },
    { name: 'val', label: 'Value to remove', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const values = parseInts(input.values, { minItems: 0, maxItems: 10 })
    const val = parseOneInt(input.val, -99, 99)
    if (typeof values === 'string') errors.values = values
    if (typeof val === 'string') errors.val = val
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [toLinked(values as number[]), val] }
  },
  run(args): Trace {
    const values = fromLinked(args[0] as ListNode | null)
    const val = args[1] as number
    // Node 0 is the dummy; node k + 1 holds values[k].
    const labels: (number | string)[] = ['dummy', ...values]
    const next = chain(labels.length)
    const dropped: number[] = []
    const frames: TraceFrame[] = []
    let prev = 0
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { val, 'prev.val': labels[prev], 'prev.next.val': next[prev] === null ? null : labels[next[prev]!] },
      view: {
        arrays: [],
        lists: [{
          name: 'list',
          label: 'list (dummy first)',
          values: labels,
          next: [...next],
          pointers: [{ name: 'prev', index: prev }, ...(next[prev] === null ? [] : [{ name: 'prev.next', index: next[prev]! }])],
          dropped: [...dropped],
        }],
      },
    })
    snap('init', `Put a dummy node in front of the head, and start prev at the dummy. Remove every ${val}.`)
    while (next[prev] !== null) {
      const candidate = next[prev]!
      snap('loop', `prev.next holds ${labels[candidate]}. Decide whether to keep it.`)
      if (labels[candidate] === val) {
        next[prev] = next[candidate]
        dropped.push(candidate)
        snap('drop', `${val} must go. Point prev.next past it. prev stays put, because the new prev.next is not checked yet.`)
      } else {
        prev = candidate
        snap('keep', `${labels[candidate]} stays. Move prev forward onto it.`)
      }
    }
    const kept = values.filter(value => value !== val)
    snap('done', kept.length ? `prev.next is null, so the list is done. Return dummy.next: ${kept.join(' → ')}.` : 'prev.next is null, so the list is done. Every node was removed, so dummy.next is null.')
    return { frames, result: toLinked(kept) }
  },
  random(rand) {
    const values = randomInts(rand, Math.floor(rand() * 9), 1, 4)
    return { values: list(values), val: String(1 + Math.floor(rand() * 4)) }
  },
}

/** Fast and slow pointers: fast moves two steps for each one slow takes, so slow ends in the middle. */
export const middleNode: Tracer = {
  id: 'middle-node',
  params: [{ name: 'values', label: 'List values', kind: 'ints' }],
  parse(input) {
    const values = parseInts(input.values)
    return typeof values === 'string' ? { ok: false, errors: { values } } : { ok: true, args: [toLinked(values)] }
  },
  run(args): Trace {
    const values = fromLinked(args[0] as ListNode | null)
    const next = chain(values.length)
    const frames: TraceFrame[] = []
    let slow = 0
    let fast: number | null = 0
    const snap = (line: string, text: string, marked?: number[]) => frames.push({
      line,
      text,
      vars: { 'slow.val': values[slow], 'fast.val': fast === null ? null : values[fast] },
      view: {
        arrays: [],
        lists: [{
          name: 'list',
          label: 'list',
          values: [...values],
          next,
          pointers: [{ name: 'slow', index: slow }, ...(fast === null ? [] : [{ name: 'fast', index: fast }])],
          marked,
        }],
      },
    })
    snap('init', 'Start slow and fast at the head.')
    while (fast !== null && next[fast] !== null) {
      snap('loop', `fast (at ${values[fast]}) has a next node, so both can move.`)
      slow = next[slow]!
      snap('slow', `slow takes one step to ${values[slow]}.`)
      fast = next[next[fast]!]
      snap('fast', fast === null ? 'fast takes two steps and runs off the end.' : `fast takes two steps to ${values[fast]}.`)
    }
    snap('done', `fast cannot take two more steps, so slow is in the middle. Return ${values[slow]}.`, [slow])
    return { frames, result: values[slow] }
  },
  random(rand) {
    return { values: list(randomInts(rand, 1 + Math.floor(rand() * 10), 0, 20)) }
  },
}

/** In-place reversal: flip one next pointer at a time, keeping prev, curr and the saved next. */
export const reverseList: Tracer = {
  id: 'reverse-list',
  params: [{ name: 'values', label: 'List values', kind: 'ints' }],
  parse(input) {
    const values = parseInts(input.values, { minItems: 0, maxItems: 10 })
    return typeof values === 'string' ? { ok: false, errors: { values } } : { ok: true, args: [toLinked(values)] }
  },
  run(args): Trace {
    const values = fromLinked(args[0] as ListNode | null)
    const next = chain(values.length)
    const frames: TraceFrame[] = []
    let prev: number | null = null
    let curr: number | null = values.length ? 0 : null
    let nxt: number | null = null
    let head: number | null = values.length ? 0 : null
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { 'prev.val': prev === null ? null : values[prev], 'curr.val': curr === null ? null : values[curr], 'nxt.val': nxt === null ? null : values[nxt] },
      view: {
        arrays: [],
        lists: [{
          name: 'list',
          label: 'nodes (arrows show each next pointer)',
          values: [...values],
          next: [...next],
          head,
          pointers: [prev === null ? null : { name: 'prev', index: prev }, curr === null ? null : { name: 'curr', index: curr }, nxt === null ? null : { name: 'nxt', index: nxt }].filter((item): item is { name: string; index: number } => item !== null),
        }],
      },
    })
    snap('init', values.length ? 'prev starts as null (the new tail points nowhere). curr starts at the head.' : 'The list is empty: curr starts as null.')
    while (curr !== null) {
      snap('loop', `curr is at ${values[curr]}, so there is a pointer to flip.`)
      nxt = next[curr]
      snap('save', nxt === null ? 'Save curr.next, which is null: this is the last node.' : `Save curr.next (${values[nxt]}) as nxt before it is overwritten.`)
      next[curr] = prev
      snap('flip', prev === null ? `Point ${values[curr]} at null. It becomes the new tail.` : `Point ${values[curr]} back at ${values[prev]}.`)
      prev = curr
      snap('prev', `Move prev up to ${values[prev]}.`)
      curr = nxt
      nxt = null
      snap('curr', curr === null ? 'Move curr to the saved next, which is null.' : `Move curr to the saved next, ${values[curr]}.`)
    }
    head = prev
    snap('done', prev === null ? 'curr is null and nothing was flipped. Return null.' : `curr is null, so every pointer is flipped. prev (${values[prev]}) is the new head. Return it.`)
    return { frames, result: toLinked([...values].reverse()) }
  },
  random(rand) {
    return { values: list(randomInts(rand, Math.floor(rand() * 9), 0, 20)) }
  },
}
