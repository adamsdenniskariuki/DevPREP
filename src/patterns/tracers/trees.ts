import { indexTree, parseTree, randomTree, treeText } from './parse'
import type { TreeNode } from './parse'
import type { ParseResult, Trace, TraceFrame, Tracer, TracerParam, VarValue } from './types'

const TREE_PARAM: TracerParam = { name: 'values', label: 'Tree in level order', kind: 'text' }
const STACK_LABEL = 'call stack (bottom → top)'
const TREE_LABEL = 'tree (shaded = on the call stack, double border = done)'

function parseRoot(input: Record<string, string>): ParseResult {
  const root = parseTree(input.values)
  return typeof root === 'string' ? { ok: false, errors: { values: root } } : { ok: true, args: [root] }
}

/** Depth-first recursion: each call asks its children for an answer, then combines them on the way back up. */
export const treeDepthTracer: Tracer = {
  id: 'tree-depth',
  params: [TREE_PARAM],
  parse: parseRoot,
  run(args): Trace {
    const root = args[0] as TreeNode | null
    const { index, view } = indexTree(root)
    const frames: TraceFrame[] = []
    const stack: TreeNode[] = []
    const done: number[] = []
    const snap = (line: string, text: string, vars: Record<string, VarValue>, at?: TreeNode) => frames.push({
      line,
      text,
      vars,
      view: {
        arrays: [{ name: 'stack', label: STACK_LABEL, values: stack.map(node => node.val) }],
        trees: [{ name: 'tree', label: TREE_LABEL, nodes: view, pointers: at ? [{ name: 'node', index: index.get(at)! }] : [], active: stack.map(node => index.get(node)!), marked: [...done] }],
      },
    })
    const depth = (node: TreeNode | null): number => {
      if (!node) return 0
      stack.push(node)
      snap('base', `Call depth on ${node.val}. It is not empty, so ask both children first.`, { node: node.val, left: null, right: null }, node)
      const left = depth(node.left)
      snap('left', node.left ? `Back at ${node.val}: its left subtree is ${left} deep.` : `${node.val} has no left child. That call hits the base case and returns 0.`, { node: node.val, left, right: null }, node)
      const right = depth(node.right)
      snap('right', node.right ? `Back at ${node.val}: its right subtree is ${right} deep.` : `${node.val} has no right child. That call returns 0.`, { node: node.val, left, right }, node)
      const result = 1 + Math.max(left, right)
      stack.pop()
      done.push(index.get(node)!)
      snap('combine', `Return 1 + max(${left}, ${right}) = ${result} from ${node.val}, and pop it off the call stack.`, { node: node.val, left, right }, node)
      return result
    }
    if (!root) snap('base', 'The tree is empty, so the first call hits the base case and returns 0.', { node: null, left: null, right: null })
    const result = depth(root)
    snap('done', `The root's call returned ${result}, so the tree is ${result} level${result === 1 ? '' : 's'} deep.`, { result })
    return { frames, result }
  },
  random(rand) {
    return { values: treeText(randomTree(rand)) }
  },
}

const ORDERS = ['pre', 'in', 'post'] as const
type Order = typeof ORDERS[number]

/** Pre-, in- and post-order are one recursion: only the moment you output the node moves. */
export const treeOrderTracer: Tracer = {
  id: 'tree-order',
  params: [TREE_PARAM, { name: 'order', label: 'Order: pre, in or post', kind: 'text' }],
  parse(input) {
    const errors: Record<string, string> = {}
    const root = parseTree(input.values)
    const order = (input.order ?? '').trim().toLowerCase().replace(/[-\s]?order$/, '')
    if (typeof root === 'string') errors.values = root
    if (!(ORDERS as readonly string[]).includes(order)) errors.order = 'Enter pre, in or post.'
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [root, order] }
  },
  run(args): Trace {
    const root = args[0] as TreeNode | null
    const order = args[1] as Order
    const { index, view } = indexTree(root)
    const frames: TraceFrame[] = []
    const stack: TreeNode[] = []
    const out: TreeNode[] = []
    const snap = (line: string, text: string, at?: TreeNode) => frames.push({
      line,
      text,
      vars: { order, node: at ? at.val : null },
      view: {
        arrays: [
          { name: 'stack', label: STACK_LABEL, values: stack.map(node => node.val) },
          { name: 'out', label: 'out', values: out.map(node => node.val) },
        ],
        trees: [{ name: 'tree', label: 'tree (shaded = on the call stack, double border = output)', nodes: view, pointers: at ? [{ name: 'node', index: index.get(at)! }] : [], active: stack.map(node => index.get(node)!), marked: out.map(node => index.get(node)!) }],
      },
    })
    const emit = (node: TreeNode, when: Order, text: string) => {
      if (order !== when) return
      out.push(node)
      snap(when, text, node)
    }
    const visit = (node: TreeNode | null) => {
      if (!node) return
      stack.push(node)
      snap('base', `Visit ${node.val}. It is not empty.`, node)
      emit(node, 'pre', `Pre-order outputs ${node.val} first, before either child.`)
      snap('left', node.left ? `Recurse into the left child, ${node.left.val}.` : `${node.val} has no left child, so that call returns at once.`, node)
      visit(node.left)
      emit(node, 'in', `In-order outputs ${node.val} after its whole left subtree and before its right.`)
      snap('right', node.right ? `Back at ${node.val}. Recurse into the right child, ${node.right.val}.` : `Back at ${node.val}. It has no right child.`, node)
      visit(node.right)
      emit(node, 'post', `Post-order outputs ${node.val} last, after both subtrees.`)
      stack.pop()
    }
    snap('init', `Start with an empty output list. The order is ${order}-order.`)
    snap('start', root ? `Call visit on the root, ${root.val}.` : 'The tree is empty, so visit returns at once.')
    visit(root)
    const result = out.map(node => node.val)
    snap('done', `Every call has returned. Return [${result.join(', ')}].`)
    return { frames, result }
  },
  random(rand) {
    return { values: treeText(randomTree(rand)), order: ORDERS[Math.floor(rand() * 3)] }
  },
}

/** Breadth-first search: a queue holds the next level, and its size at the start of a round is the level's width. */
export const levelOrderTracer: Tracer = {
  id: 'level-order',
  params: [TREE_PARAM],
  parse: parseRoot,
  run(args): Trace {
    const root = args[0] as TreeNode | null
    const { index, view } = indexTree(root)
    const frames: TraceFrame[] = []
    const queue: TreeNode[] = root ? [root] : []
    const done: number[] = []
    const levels: number[][] = []
    let level: number[] = []
    let size: number | null = null
    const snap = (line: string, text: string, at?: TreeNode) => frames.push({
      line,
      text,
      vars: { size, node: at ? at.val : null },
      view: {
        arrays: [
          { name: 'queue', label: 'queue (front → back)', values: queue.map(node => node.val) },
          { name: 'level', label: 'level', values: [...level] },
          { name: 'levels', label: 'levels', values: levels.map(item => `[${item.join(', ')}]`) },
        ],
        trees: [{ name: 'tree', label: 'tree (shaded = in the queue, double border = done)', nodes: view, pointers: at ? [{ name: 'node', index: index.get(at)! }] : [], active: queue.map(node => index.get(node)!), marked: [...done] }],
      },
    })
    snap('init', root ? `Put the root, ${root.val}, in the queue.` : 'The tree is empty, so the queue starts empty.')
    while (queue.length) {
      snap('loop', `The queue holds ${queue.length} node${queue.length === 1 ? '' : 's'}. They are exactly the next level.`)
      size = queue.length
      level = []
      snap('size', `Take a snapshot of the size: ${size}. Only that many pops belong to this level.`)
      for (let i = 0; i < size; i++) {
        const node = queue.shift()!
        level.push(node.val)
        done.push(index.get(node)!)
        snap('pop', `Pop ${node.val} from the front and add it to this level.`, node)
        for (const child of [node.left, node.right]) {
          if (!child) continue
          queue.push(child)
          snap('push', `Queue ${node.val}'s child ${child.val} at the back. It belongs to the next level.`, node)
        }
      }
      levels.push(level)
      snap('level', `This level is done: [${level.join(', ')}].`)
    }
    snap('done', `The queue is empty. Return ${levels.length} level${levels.length === 1 ? '' : 's'}.`)
    return { frames, result: levels }
  },
  random(rand) {
    return { values: treeText(randomTree(rand)) }
  },
}
