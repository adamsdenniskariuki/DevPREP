import type { TreeViewNode } from './tracers'

/** Places leaves (and empty child slots) one column apart, and each parent above the middle of its children. */
export function layoutTree(nodes: readonly TreeViewNode[]) {
  const pos: { x: number; y: number }[] = []
  let column = 0
  let rows = 0
  const place = (index: number | null, depth: number): number => {
    if (index === null) return column++
    rows = Math.max(rows, depth + 1)
    const children = nodes[index].children
    const x = children.length === 0 ? column++ : (() => {
      const xs = children.map(child => place(child, depth + 1))
      return (xs[0] + xs[xs.length - 1]) / 2
    })()
    pos[index] = { x, y: depth }
    return x
  }
  if (nodes.length) place(0, 0)
  return { pos, columns: Math.max(column, 1), rows }
}
