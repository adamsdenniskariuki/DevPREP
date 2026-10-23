import { list, parseInts, parseOneInt } from './parse'
import type { Trace, TraceFrame, Tracer, TreeViewNode } from './types'

/** Backtracking: choose a number, explore what is left, then un-choose it. Sorting lets one test prune a whole branch. */
export const pickSum: Tracer = {
  id: 'pick-sum',
  params: [
    { name: 'nums', label: 'Distinct numbers (up to 4)', kind: 'ints' },
    { name: 'target', label: 'Target sum', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const nums = parseInts(input.nums, { min: 1, max: 20, maxItems: 4 })
    if (typeof nums === 'string') errors.nums = nums
    else if (new Set(nums).size !== nums.length) errors.nums = 'Use distinct numbers.'
    const target = parseOneInt(input.target, 1, 40)
    if (typeof target === 'string') errors.target = target
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [nums, target] }
  },
  run(args): Trace {
    const a = [...(args[0] as number[])].sort((x, y) => x - y)
    const target = args[1] as number
    const out: number[][] = []
    const path: number[] = []
    const nodes: TreeViewNode[] = [{ label: '{}', children: [] }]
    const active: number[] = [0]
    const marked: number[] = []
    const dropped: number[] = []
    const frames: TraceFrame[] = []
    let at = 0
    let vars: { start: number | null; left: number | null; i: number | null } = { start: null, left: null, i: null }
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { ...vars },
      view: {
        arrays: [
          { name: 'a', label: 'a (sorted)', values: [...a], ...(vars.i !== null && vars.i < a.length ? { pointers: [{ name: 'i', index: vars.i }] } : {}) },
          { name: 'path', label: 'path (chosen so far)', values: [...path] },
        ],
        trees: [{
          name: 'choices',
          label: 'decision tree (shaded = current path, double border = sums to the target, dashed = pruned)',
          nodes: nodes.map(node => ({ ...node, children: [...node.children] })),
          active: [...active],
          marked: [...marked],
          dropped: [...dropped],
          pointers: [{ name: 'here', index: at }],
        }],
      },
    })
    const explore = (start: number, left: number) => {
      vars = { start, left, i: null }
      if (left === 0) {
        out.push([...path])
        marked.push(at)
        snap('found', `left is 0, so [${path.join(', ')}] sums to ${target}. Save a copy and return.`)
        return
      }
      for (let i = start; i < a.length; i++) {
        vars = { start, left, i }
        const parent = at
        if (a[i] > left) {
          nodes.push({ label: String(a[i]), children: [] })
          nodes[parent].children.push(nodes.length - 1)
          dropped.push(nodes.length - 1)
          snap('prune', `${a[i]} is more than the ${left} left. The numbers are sorted, so every later one is too: stop this loop.`)
          break
        }
        nodes.push({ label: String(a[i]), children: [] })
        nodes[parent].children.push(nodes.length - 1)
        at = nodes.length - 1
        active.push(at)
        path.push(a[i])
        snap('choose', `Choose ${a[i]}. path = [${path.join(', ')}].`)
        snap('explore', `Explore with only numbers after ${a[i]} and ${left - a[i]} left.`)
        explore(i + 1, left - a[i])
        vars = { start, left, i }
        path.pop()
        active.pop()
        at = parent
        snap('unchoose', `Back from ${a[i]}: un-choose it, so path = [${path.join(', ')}] and the next number can be tried.`)
      }
    }
    snap('init', `Sort the numbers: [${a.join(', ')}]. Search for sets that sum to ${target}, using each number at most once.`)
    explore(0, target)
    vars = { start: null, left: null, i: null }
    snap('done', out.length ? `The search is finished. Return ${out.length} set${out.length === 1 ? '' : 's'}: ${out.map(set => `[${set.join(', ')}]`).join(', ')}.` : 'The search is finished and no set sums to the target. Return [].')
    return { frames, result: out }
  },
  random(rand) {
    const pool = Array.from({ length: 12 }, (_, i) => i + 1)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const nums = pool.slice(0, 2 + Math.floor(rand() * 3))
    return { nums: list(nums), target: String(1 + Math.floor(rand() * 20)) }
  },
}
