export const MAX_ITEMS = 12
export const MIN_VALUE = -99
export const MAX_VALUE = 99

/** Parses "3, 1 4" into whole numbers within small limits. Returns an error message when it cannot. */
export function parseInts(text: string | undefined, { min = MIN_VALUE, max = MAX_VALUE, minItems = 1, maxItems = MAX_ITEMS } = {}): number[] | string {
  const parts = (text ?? '').trim().replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)
  if (parts.length < minItems) return minItems === 1 ? 'Enter at least one number.' : `Enter at least ${minItems} numbers.`
  if (parts.length > maxItems) return `Use at most ${maxItems} numbers.`
  const values: number[] = []
  for (const part of parts) {
    if (!/^-?\d+$/.test(part)) return `“${part}” is not a whole number.`
    const value = Number(part)
    if (value < min || value > max) return `Keep numbers between ${min} and ${max}.`
    values.push(value)
  }
  return values
}

export function parseOneInt(text: string | undefined, min = -999, max = 999): number | string {
  const value = (text ?? '').trim()
  if (!value) return 'Enter a number.'
  if (!/^-?\d+$/.test(value)) return `“${value}” is not a whole number.`
  const n = Number(value)
  if (n < min || n > max) return `Keep it between ${min} and ${max}.`
  return n
}

export function randomInts(rand: () => number, length: number, min: number, max: number): number[] {
  return Array.from({ length }, () => min + Math.floor(rand() * (max - min + 1)))
}

export const list = (values: number[]) => values.join(', ')

export interface ListNode { val: number; next: ListNode | null }

/** Builds the nested { val, next } list that pattern code receives. */
export function toLinked(values: readonly number[]): ListNode | null {
  let head: ListNode | null = null
  for (let i = values.length - 1; i >= 0; i--) head = { val: values[i], next: head }
  return head
}

export function fromLinked(head: ListNode | null): number[] {
  const values: number[] = []
  for (let node = head; node; node = node.next) values.push(node.val)
  return values
}

/** Next indexes for nodes 0..n-1 linked in order. */
export const chain = (n: number): (number | null)[] => Array.from({ length: n }, (_, i) => i + 1 < n ? i + 1 : null)

export interface TreeNode { val: number; left: TreeNode | null; right: TreeNode | null }

export const MAX_TREE_NODES = 15
export const MAX_TREE_DEPTH = 4

/** Parses a level-order list such as "3, 9, 20, null, null, 15, 7" into the nested { val, left, right } tree that pattern code receives. */
export function parseTree(text: string | undefined): TreeNode | null | string {
  const parts = (text ?? '').trim().replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)
  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'null')) return null
  const values: (number | null)[] = []
  for (const part of parts) {
    if (part === 'null' || part === '_') { values.push(null); continue }
    if (!/^\d+$/.test(part)) return `“${part}” is not a whole number or null.`
    const value = Number(part)
    if (value > 99) return 'Keep values between 0 and 99.'
    values.push(value)
  }
  if (values[0] === null) return 'The root cannot be null. Leave the box empty for an empty tree.'
  if (values.filter(value => value !== null).length > MAX_TREE_NODES) return `Use at most ${MAX_TREE_NODES} nodes.`
  const root: TreeNode = { val: values[0], left: null, right: null }
  const queue = [root]
  let i = 1
  while (i < values.length) {
    const parent = queue.shift()
    if (!parent) return 'There are more values than open child slots.'
    for (const side of ['left', 'right'] as const) {
      if (i >= values.length) break
      const value = values[i++]
      if (value !== null) { parent[side] = { val: value, left: null, right: null }; queue.push(parent[side]!) }
    }
  }
  if (treeDepth(root) > MAX_TREE_DEPTH) return `Keep the tree at most ${MAX_TREE_DEPTH} levels deep.`
  return root
}

export function treeDepth(node: TreeNode | null): number {
  return node ? 1 + Math.max(treeDepth(node.left), treeDepth(node.right)) : 0
}

/** Level-order text with trailing nulls trimmed, the inverse of parseTree. */
export function treeText(root: TreeNode | null): string {
  const out: (number | null)[] = []
  const queue: (TreeNode | null)[] = [root]
  while (queue.length) {
    const node = queue.shift()!
    out.push(node ? node.val : null)
    if (node) queue.push(node.left, node.right)
  }
  while (out.length && out[out.length - 1] === null) out.pop()
  return out.map(value => value === null ? 'null' : String(value)).join(', ')
}

export function randomTree(rand: () => number, depth = MAX_TREE_DEPTH, chance = 0.75): TreeNode | null {
  if (depth === 0 || rand() > chance) return null
  return { val: Math.floor(rand() * 30), left: randomTree(rand, depth - 1, chance * 0.9), right: randomTree(rand, depth - 1, chance * 0.9) }
}

/** Numbers the nodes in level order, so node 0 is the root, and builds the tree view's node list. */
export function indexTree(root: TreeNode | null) {
  const nodes: TreeNode[] = []
  const queue = root ? [root] : []
  while (queue.length) {
    const node = queue.shift()!
    nodes.push(node)
    if (node.left) queue.push(node.left)
    if (node.right) queue.push(node.right)
  }
  const index = new Map(nodes.map((node, i) => [node, i]))
  const view = nodes.map(node => ({
    label: String(node.val),
    children: node.left || node.right ? [node.left ? index.get(node.left)! : null, node.right ? index.get(node.right)! : null] : [],
  }))
  return { nodes, index, view }
}

/** Tree view nodes for an array heap: the children of i are 2i + 1 and 2i + 2. */
export function heapNodes(values: readonly (number | string)[]) {
  return values.map((value, i) => {
    const left = 2 * i + 1 < values.length ? 2 * i + 1 : null
    const right = 2 * i + 2 < values.length ? 2 * i + 2 : null
    return { label: String(value), children: left === null ? [] : [left, right] }
  })
}

/** Parses "car, cat dog" into lowercase words. */
export function parseWords(text: string | undefined, { minItems = 1, maxItems = 5, maxLength = 5 } = {}): string[] | string {
  const words = (text ?? '').trim().split(/[\s,]+/).filter(Boolean)
  if (words.length < minItems) return minItems === 1 ? 'Enter a word.' : `Enter at least ${minItems} words.`
  if (words.length > maxItems) return `Use at most ${maxItems} words.`
  for (const word of words) {
    if (!/^[a-z]+$/.test(word)) return `“${word}” must use only the letters a to z, in lowercase.`
    if (word.length > maxLength) return `Keep each word to at most ${maxLength} letters.`
  }
  return words
}

/** Parses rows separated by "/" or ";", such as "1 2 3 / 4 5 6", into a rectangular grid. */
export function parseGrid(text: string | undefined, { maxRows = 5, maxCols = 5 } = {}): number[][] | string {
  const rows = (text ?? '').trim().split(/[/;\n]/).map(row => row.trim()).filter(Boolean)
  if (rows.length === 0) return 'Enter at least one row.'
  if (rows.length > maxRows) return `Use at most ${maxRows} rows.`
  const grid: number[][] = []
  for (const row of rows) {
    const values = parseInts(row, { min: 0, max: 99, maxItems: maxCols })
    if (typeof values === 'string') return values === `Use at most ${maxCols} numbers.` ? `Use at most ${maxCols} numbers per row.` : values
    grid.push(values)
  }
  if (grid.some(row => row.length !== grid[0].length)) return 'Every row needs the same number of values.'
  return grid
}

export const gridText = (grid: readonly number[][]) => grid.map(row => row.join(' ')).join(' / ')
