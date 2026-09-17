import { describe, expect, it } from 'vitest'
import { dsaLessons } from './dsa'
import { starterLessons } from './starter'

function content(id: string) {
  const result = dsaLessons.find((item) => item.id === id)
  if (!result) throw new Error(`Unknown lesson ${id}`)
  return result
}

function words(value: unknown): number {
  if (typeof value === 'string') return value.trim().split(/\s+/).length
  if (Array.isArray(value)) return value.reduce((total, item) => total + words(item), 0)
  if (value && typeof value === 'object') return words(Object.values(value))
  return 0
}

function rangeTotals(values: number[], ranges: number[][]): number[] {
  const prefix = [0]
  for (const value of values) prefix.push(prefix[prefix.length - 1] + value)
  return ranges.map(([left, right]) => prefix[right] - prefix[left])
}

function sortedPair(values: number[], target: number): number[] {
  let left = 0
  let right = values.length - 1
  while (left < right) {
    const sum = values[left] + values[right]
    if (sum === target) return [left, right]
    if (sum < target) left++
    else right--
  }
  return []
}

function completionOrder(work: number[]): number[] {
  const remaining = [...work]
  const queue = work.map((_, index) => index)
  const completed: number[] = []
  let head = 0
  while (head < queue.length) {
    const job = queue[head++]
    remaining[job]--
    if (remaining[job] === 0) completed.push(job)
    else queue.push(job)
  }
  return completed
}

interface Link {
  value: number
  next: Link | null
}

function reverseList(head: Link | null): Link | null {
  let previous: Link | null = null
  let current = head
  while (current) {
    const nextNode = current.next
    current.next = previous
    previous = current
    current = nextNode
  }
  return previous
}

type RecordValue = [number, string]

function stableSort(records: RecordValue[]): RecordValue[] {
  const n = records.length
  let source = [...records]
  let target = new Array<RecordValue>(n)
  for (let width = 1; width < n; width *= 2) {
    for (let start = 0; start < n; start += 2 * width) {
      const mid = Math.min(start + width, n)
      const end = Math.min(start + 2 * width, n)
      let i = start
      let j = mid
      for (let out = start; out < end; out++) {
        if (i < mid && (j === end || source[i][0] <= source[j][0])) {
          target[out] = source[i++]
        } else {
          target[out] = source[j++]
        }
      }
    }
    ;[source, target] = [target, source]
  }
  return source
}

function power(base: number, exponent: number): number {
  if (exponent === 0) return 1
  const half = power(base, Math.floor(exponent / 2))
  const squared = half * half
  return exponent % 2 === 1 ? squared * base : squared
}

interface Tree {
  value: number
  left: Tree | null
  right: Tree | null
}

function tree(value: number, left: Tree | null = null, right: Tree | null = null): Tree {
  return { value, left, right }
}

function isStrictBST(root: Tree | null): boolean {
  function validate(node: Tree | null, lower?: number, upper?: number): boolean {
    if (!node) return true
    if (lower !== undefined && node.value <= lower) return false
    if (upper !== undefined && node.value >= upper) return false
    return validate(node.left, lower, node.value) && validate(node.right, node.value, upper)
  }
  return validate(root)
}

function kthLargest(values: number[], k: number): number | undefined {
  if (k < 1 || k > values.length) return undefined
  const heap: number[] = []
  for (const value of values) {
    if (heap.length < k) {
      heap.push(value)
      let i = heap.length - 1
      while (i > 0) {
        const parent = Math.floor((i - 1) / 2)
        if (heap[parent] <= heap[i]) break
        ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
        i = parent
      }
    } else if (value > heap[0]) {
      heap[0] = value
      let i = 0
      while (2 * i + 1 < heap.length) {
        let child = 2 * i + 1
        if (child + 1 < heap.length && heap[child + 1] < heap[child]) child++
        if (heap[i] <= heap[child]) break
        ;[heap[i], heap[child]] = [heap[child], heap[i]]
        i = child
      }
    }
  }
  return heap[0]
}

function neighborsFor(n: number, edges: number[][]): number[][] {
  const neighbors = Array.from({ length: n }, () => [] as number[])
  for (const [a, b] of edges) {
    neighbors[a].push(b)
    neighbors[b].push(a)
  }
  return neighbors
}

function hopDistances(n: number, edges: number[][], start: number): number[] {
  const neighbors = neighborsFor(n, edges)
  const distance = new Array<number>(n).fill(-1)
  distance[start] = 0
  const queue = [start]
  let head = 0
  while (head < queue.length) {
    const u = queue[head++]
    for (const v of neighbors[u]) {
      if (distance[v] === -1) {
        distance[v] = distance[u] + 1
        queue.push(v)
      }
    }
  }
  return distance
}

function componentSizes(n: number, edges: number[][]): number[] {
  const neighbors = neighborsFor(n, edges)
  const seen = new Array<boolean>(n).fill(false)
  const sizes: number[] = []
  for (let root = 0; root < n; root++) {
    if (seen[root]) continue
    const stack = [root]
    seen[root] = true
    let size = 0
    while (stack.length) {
      const u = stack.pop()!
      size++
      for (const v of neighbors[u]) {
        if (!seen[v]) {
          seen[v] = true
          stack.push(v)
        }
      }
    }
    sizes.push(size)
  }
  return sizes
}

function dependencyOrder(n: number, edges: number[][]): number[] | undefined {
  const outgoing = Array.from({ length: n }, () => [] as number[])
  const indegree = new Array<number>(n).fill(0)
  for (const [a, b] of edges) {
    outgoing[a].push(b)
    indegree[b]++
  }
  const queue: number[] = []
  for (let v = 0; v < n; v++) {
    if (indegree[v] === 0) queue.push(v)
  }
  const order: number[] = []
  let head = 0
  while (head < queue.length) {
    const u = queue[head++]
    order.push(u)
    for (const v of outgoing[u]) {
      if (--indegree[v] === 0) queue.push(v)
    }
  }
  return order.length === n ? order : undefined
}

function subsets(values: number[]): number[][] {
  const output: number[][] = []
  const path: number[] = []
  function visit(index: number) {
    if (index === values.length) {
      output.push([...path])
      return
    }
    visit(index + 1)
    path.push(values[index])
    visit(index + 1)
    path.pop()
  }
  visit(0)
  return output
}

function selectIntervals(intervals: number[][]): number[] {
  const records = intervals.map(([start, end], index) => ({ start, end, index }))
    .sort((a, b) => a.end - b.end || a.index - b.index)
  const chosen: number[] = []
  let lastEnd: number | undefined
  for (const record of records) {
    if (lastEnd === undefined || record.start >= lastEnd) {
      chosen.push(record.index)
      lastEnd = record.end
    }
  }
  return chosen
}

function maxNonAdjacent(values: number[]): number {
  let twoBack = 0
  let oneBack = 0
  for (const value of values) {
    const current = Math.max(oneBack, twoBack + value)
    twoBack = oneBack
    oneBack = current
  }
  return oneBack
}

function countGridPaths(blocked: number[][]): number {
  if (!blocked.length || !blocked[0].length) return 0
  const columns = blocked[0].length
  const rowWays = new Array<number>(columns).fill(0)
  rowWays[0] = 1
  for (const row of blocked) {
    for (let c = 0; c < columns; c++) {
      if (row[c] === 1) rowWays[c] = 0
      else if (c > 0) rowWays[c] += rowWays[c - 1]
    }
  }
  return rowWays[columns - 1]
}

describe('expanded DSA curriculum contracts', () => {
  it('has 19 prerequisite-ordered lessons in the requested topic sequence', () => {
    expect(dsaLessons.map(({ id }) => id)).toEqual([
      'arrays-prefix-foundations', 'hash-map-complements', 'two-pointers-sorted-pairs',
      'sliding-window-distinct', 'stack-balanced-delimiters', 'queues-fifo-simulation',
      'linked-lists-reversal', 'binary-search-lower-bound', 'sorting-stable-merge',
      'recursion-fast-power', 'trees-bst-validation', 'heaps-top-k',
      'graph-bfs-shortest-hops', 'graph-dfs-components', 'graphs-topological-order',
      'backtracking-subsets', 'greedy-interval-selection', 'dp-nonadjacent-sum', 'dp-grid-paths',
    ])
    const earlier = new Set<string>()
    for (const item of dsaLessons) {
      expect(item.track).toBe('dsa')
      expect(earlier.has(item.id)).toBe(false)
      for (const prerequisite of item.prerequisites) expect(earlier.has(prerequisite)).toBe(true)
      expect(new Set(item.prerequisites).size).toBe(item.prerequisites.length)
      earlier.add(item.id)
    }
  })

  it.each(dsaLessons)('$id has complete, substantial teaching and graduated practice', (item) => {
    expect(item.minutes).toBeGreaterThanOrEqual(30)
    expect(item.minutes).toBeLessThanOrEqual(55)
    expect(item.prerequisiteNotes.length).toBeGreaterThan(50)
    expect(item.objectives.length).toBeGreaterThanOrEqual(3)
    expect(item.concepts.length).toBeGreaterThanOrEqual(3)
    expect(item.hints).toHaveLength(2)
    expect(item.checklist.length).toBeGreaterThanOrEqual(3)
    expect(item.pitfalls.length).toBeGreaterThanOrEqual(3)
    expect(item.walkthrough.length).toBeGreaterThanOrEqual(2)
    expect(item.extraPractice.map(({ id }) => id)).toEqual(['warmup', 'stretch'])
    expect(item.followUps.length).toBeGreaterThanOrEqual(2)
    expect(item.takeaways.length).toBeGreaterThanOrEqual(3)
    expect(item.starter).toContain('function ')
    expect(item.solution).toContain('function ')
    expect(item.solution).toMatch(/[Tt]ime/)
    expect(item.solution).toMatch(/space|stack/)
    expect(words(item)).toBeGreaterThanOrEqual(700)
    expect(words(item)).toBeLessThanOrEqual(1100)
    for (const section of [...item.concepts, ...item.walkthrough]) {
      expect(section.title.trim()).not.toBe('')
      expect(words(section.body)).toBeGreaterThanOrEqual(30)
    }
    for (const practice of item.extraPractice) {
      expect(practice.hints).toHaveLength(2)
      expect(practice.hints.every((hint) => hint.length > 20)).toBe(true)
      expect(practice.checklist.length).toBeGreaterThanOrEqual(2)
      expect(words(practice.solution)).toBeGreaterThanOrEqual(35)
      expect(practice.solution).toMatch(/[Tt]ime/)
      expect(practice.solution).toMatch(/space|storage|stack|auxiliary|output/)
    }
  })

  it('retains every published DSA core contract verbatim without shared mutable arrays', () => {
    const originals = starterLessons.filter(({ track }) => track === 'dsa')
    expect(originals).toHaveLength(6)
    for (const original of originals) {
      const enriched = content(original.id)
      for (const key of ['title', 'summary', 'task', 'starter', 'solution', 'example', 'objectives', 'hints', 'checklist', 'pitfalls'] as const) {
        expect(enriched[key], `${original.id}.${key}`).toEqual(original[key])
      }
      expect(enriched.concepts.slice(0, original.concepts.length)).toEqual(original.concepts)
      expect(enriched.concepts.length).toBeGreaterThanOrEqual(original.concepts.length + 2)
      expect(enriched.hints).not.toBe(original.hints)
      expect(enriched.checklist).not.toBe(original.checklist)
      expect(enriched.objectives).not.toBe(original.objectives)
      expect(enriched.pitfalls).not.toBe(original.pitfalls)
      expect(enriched.concepts[0]).not.toBe(original.concepts[0])
      expect(words({
        concepts: enriched.concepts.slice(original.concepts.length),
        prerequisiteNotes: enriched.prerequisiteNotes,
        walkthrough: enriched.walkthrough,
        extraPractice: enriched.extraPractice,
        followUps: enriched.followUps,
        takeaways: enriched.takeaways,
      })).toBeGreaterThanOrEqual(400)
    }
  })
})

describe('worked algorithms tied to published lesson examples', () => {
  it('answers prefix intervals, including negatives and empty boundaries', () => {
    expect(content('arrays-prefix-foundations').example).toContain('rangeTotals([3, -2, 5, 1], [[0,4],[1,3],[2,2]]) returns [7,3,0]')
    expect(rangeTotals([3, -2, 5, 1], [[0, 4], [1, 3], [2, 2]])).toEqual([7, 3, 0])
    expect(rangeTotals([], [[0, 0]])).toEqual([0])
    expect(rangeTotals([9], [[0, 1], [1, 1], [0, 0]])).toEqual([9, 0, 0])
  })

  it('preserves the old sorted-pointer trace and distinct-index edge cases', () => {
    const item = content('two-pointers-sorted-pairs')
    expect(item.example).toContain('values = [-5, -1, 3, 7, 11], target = 10')
    expect(item.example).toContain('Return [1, 4]')
    expect(sortedPair([-5, -1, 3, 7, 11], 10)).toEqual([1, 4])
    expect(sortedPair([-4, 0, 2, 5, 9], 7)).toEqual([2, 3])
    expect(sortedPair([2, 2], 4)).toEqual([0, 1])
    expect(sortedPair([2], 4)).toEqual([])
    expect(sortedPair([], 0)).toEqual([])
    expect(sortedPair([-4, -3, -1], -2)).toEqual([])
  })

  it('simulates FIFO turns rather than shortest-job ordering', () => {
    expect(content('queues-fifo-simulation').example).toContain('completionOrder([2,1,3]) returns [1,0,2]')
    expect(completionOrder([2, 1, 3])).toEqual([1, 0, 2])
    expect(completionOrder([])).toEqual([])
    expect(completionOrder([4])).toEqual([0])
    expect(completionOrder([1, 1, 1])).toEqual([0, 1, 2])
    expect(completionOrder([2, 2, 1])).toEqual([2, 0, 1])
  })

  it('reverses linked nodes without losing identity, including repeated values', () => {
    expect(content('linked-lists-reversal').example).toContain('4 -> 1 -> 7 -> null) returns 7 -> 1 -> 4 -> null')
    const third: Link = { value: 7, next: null }
    const second: Link = { value: 1, next: third }
    const first: Link = { value: 4, next: second }
    const reversed = reverseList(first)
    expect(reversed).toBe(third)
    expect(third.next).toBe(second)
    expect(second.next).toBe(first)
    expect(first.next).toBeNull()
    expect(reverseList(reversed)).toBe(first)
    expect(first.next).toBe(second)
    expect(second.next).toBe(third)
    expect(third.next).toBeNull()
    expect(reverseList(null)).toBeNull()
    const singleton: Link = { value: 0, next: null }
    expect(reverseList(singleton)).toBe(singleton)
    const duplicate: Link = { value: 0, next: singleton }
    expect(reverseList(duplicate)).toBe(singleton)
    expect(singleton.next).toBe(duplicate)
    expect(duplicate.next).toBeNull()
  })

  it('merges stably without mutation and handles incomplete runs', () => {
    expect(content('sorting-stable-merge').example).toContain('stableSort([(3,"a"),(1,"b"),(3,"c"),(2,"d")]) returns [(1,"b"),(2,"d"),(3,"a"),(3,"c")]')
    const input: RecordValue[] = [[3, 'a'], [1, 'b'], [3, 'c'], [2, 'd']]
    const snapshot = structuredClone(input)
    expect(stableSort(input)).toEqual([[1, 'b'], [2, 'd'], [3, 'a'], [3, 'c']])
    expect(input).toEqual(snapshot)
    expect(stableSort([])).toEqual([])
    const singleton: RecordValue[] = [[0, 'only']]
    expect(stableSort(singleton)).toEqual(singleton)
    expect(stableSort(singleton)).not.toBe(singleton)
    for (let length = 0; length <= 40; length++) {
      const records: RecordValue[] = Array.from({ length }, (_, i) => [((i * 17) % 7) - 3, `id-${i}`])
      expect(stableSort(records)).toEqual([...records].sort((a, b) => a[0] - b[0]))
    }
  })

  it('squares one recursive half-power and obeys the zero-exponent contract', () => {
    expect(content('recursion-fast-power').example).toContain('power(3,5) returns 243')
    expect(power(3, 5)).toBe(243)
    expect(power(-2, 3)).toBe(-8)
    expect(power(-2, 4)).toBe(16)
    expect(power(7, 0)).toBe(1)
    expect(power(0, 0)).toBe(1)
    expect(power(0, 5)).toBe(0)
  })

  it('validates ancestor bounds, duplicates, empty trees, and extreme keys', () => {
    const example = content('trees-bst-validation').example
    expect(example).toContain('8 with left 3 and right 10 whose left child is 6) returns false')
    expect(example).toContain('8 with left 3 and right 10) returns true')
    expect(isStrictBST(tree(8, tree(3), tree(10, tree(6))))).toBe(false)
    expect(isStrictBST(tree(8, tree(3), tree(10)))).toBe(true)
    expect(isStrictBST(tree(8, tree(8)))).toBe(false)
    expect(isStrictBST(tree(8, null, tree(8)))).toBe(false)
    expect(isStrictBST(null)).toBe(true)
    expect(isStrictBST(tree(Number.MIN_SAFE_INTEGER, null, tree(Number.MAX_SAFE_INTEGER)))).toBe(true)
    expect(isStrictBST(tree(0, tree(-1, tree(-2))))).toBe(true)
  })

  it('retains the largest k occurrences and agrees with an independent sorted oracle', () => {
    expect(content('heaps-top-k').example).toContain('kthLargest([5,1,5,3,8], 3) returns 5')
    expect(kthLargest([5, 1, 5, 3, 8], 3)).toBe(5)
    expect(kthLargest([], 1)).toBeUndefined()
    expect(kthLargest([2], 0)).toBeUndefined()
    expect(kthLargest([2], 2)).toBeUndefined()
    expect(kthLargest([-4, -2, -2], 1)).toBe(-2)
    expect(kthLargest([-4, -2, -2], 3)).toBe(-4)
    for (let length = 1; length <= 30; length++) {
      const values = Array.from({ length }, (_, i) => ((i * 19 + length) % 13) - 6)
      const snapshot = [...values]
      const sorted = [...values].sort((a, b) => b - a)
      for (let k = 1; k <= length; k++) expect(kthLargest(values, k)).toBe(sorted[k - 1])
      expect(values).toEqual(snapshot)
    }
  })

  it('matches both published BFS graphs without revisiting a diamond or triangle', () => {
    const item = content('graph-bfs-shortest-hops')
    expect(item.example).toContain('Distances are [0, 1, 1, 2, -1]')
    expect(item.example).toContain('[0,1], [0,2], [1,3], [2,3]')
    expect(hopDistances(5, [[0, 1], [0, 2], [1, 3], [2, 3]], 0)).toEqual([0, 1, 1, 2, -1])
    expect(item.task).toContain('edges = [[0,1],[1,2],[2,0],[2,3],[3,4]], start = 1 returns [1,0,1,2,3,-1]')
    expect(hopDistances(6, [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4]], 1)).toEqual([1, 0, 1, 2, 3, -1])
    expect(hopDistances(1, [], 0)).toEqual([0])
    expect(hopDistances(3, [], 1)).toEqual([-1, 0, -1])
  })

  it('finds all DFS components despite cycles, repeated edges, and isolated vertices', () => {
    expect(content('graph-dfs-components').example).toContain('componentSizes(6, [[0,1],[1,2],[2,0],[3,4]]) returns [3,2,1]')
    expect(componentSizes(6, [[0, 1], [1, 2], [2, 0], [3, 4]])).toEqual([3, 2, 1])
    expect(componentSizes(0, [])).toEqual([])
    expect(componentSizes(3, [])).toEqual([1, 1, 1])
    expect(componentSizes(3, [[0, 0], [0, 1], [0, 1]])).toEqual([2, 1])
  })

  it('schedules directed prerequisites and rejects a cycle even beside ready work', () => {
    const example = content('graphs-topological-order').example
    expect(example).toContain('dependencyOrder(4, [[0,2],[1,2],[2,3]]) returns [0,1,2,3]')
    expect(example).toContain('dependencyOrder(2, [[0,1],[1,0]]) returns absent')
    const edges = [[0, 2], [1, 2], [2, 3]]
    const order = dependencyOrder(4, edges)!
    expect(order).toEqual([0, 1, 2, 3])
    for (const [a, b] of edges) expect(order.indexOf(a)).toBeLessThan(order.indexOf(b))
    expect(dependencyOrder(2, [[0, 1], [1, 0]])).toBeUndefined()
    expect(dependencyOrder(3, [[0, 1], [1, 0]])).toBeUndefined()
    expect(dependencyOrder(1, [[0, 0]])).toBeUndefined()
    expect(dependencyOrder(0, [])).toEqual([])
    expect(dependencyOrder(3, [])).toEqual([0, 1, 2])
    expect(dependencyOrder(3, [[0, 1]])).toEqual([0, 2, 1])
  })

  it('enumerates independent subset snapshots with correct empty-input semantics', () => {
    expect(content('backtracking-subsets').example).toContain('subsets([2,5]) returns [[],[5],[2],[2,5]]')
    expect(content('backtracking-subsets').example).toContain('subsets([]) returns [[]]')
    const input = [2, 5]
    const result = subsets(input)
    expect(result).toEqual([[], [5], [2], [2, 5]])
    expect(new Set(result).size).toBe(result.length)
    result[0].push(99)
    expect(result.slice(1)).toEqual([[5], [2], [2, 5]])
    expect(input).toEqual([2, 5])
    expect(subsets([])).toEqual([[]])
    expect(subsets([7])).toEqual([[], [7]])
    const larger = subsets([1, 2, 3, 4])
    expect(larger).toHaveLength(16)
    expect(new Set(larger.map((entry) => JSON.stringify(entry))).size).toBe(16)
  })

  it('chooses maximum-cardinality intervals, accepts touching endpoints, and preserves IDs', () => {
    expect(content('greedy-interval-selection').example).toContain('selectIntervals([[0,4],[1,2],[2,3],[3,5]]) returns [1,2,3]')
    const input = [[0, 4], [1, 2], [2, 3], [3, 5]]
    const snapshot = structuredClone(input)
    expect(selectIntervals(input)).toEqual([1, 2, 3])
    expect(input).toEqual(snapshot)
    expect(selectIntervals([])).toEqual([])
    expect(selectIntervals([[-5, -3], [-3, -1], [0, 1]])).toEqual([0, 1, 2])
    expect(selectIntervals([[0, 3], [3, 6], [2, 4]])).toEqual([0, 1])
    expect(selectIntervals([[0, 2], [1, 2], [2, 3]])).toEqual([0, 2])
  })

  it('checks greedy optimality against exhaustive small interval subsets', () => {
    const candidates = [[0, 1], [0, 3], [1, 2], [1, 4], [2, 3], [3, 4]]
    for (let inputMask = 0; inputMask < 1 << candidates.length; inputMask++) {
      const intervals = candidates.filter((_, i) => (inputMask & (1 << i)) !== 0)
      let optimum = 0
      for (let choice = 0; choice < 1 << intervals.length; choice++) {
        const selected = intervals.filter((_, i) => (choice & (1 << i)) !== 0)
        const compatible = selected.every(([a, b], i) =>
          selected.slice(i + 1).every(([c, d]) => b <= c || d <= a))
        if (compatible) optimum = Math.max(optimum, selected.length)
      }
      const chosen = selectIntervals(intervals)
      expect(chosen).toHaveLength(optimum)
      for (let i = 1; i < chosen.length; i++) {
        expect(intervals[chosen[i - 1]][1]).toBeLessThanOrEqual(intervals[chosen[i]][0])
      }
    }
  })

  it('computes nonadjacent prefix optima with empty, negative, and wide-sum cases', () => {
    expect(content('dp-nonadjacent-sum').example).toContain('maxNonAdjacent([4,1,1,4]) returns 8')
    expect(content('dp-nonadjacent-sum').example).toContain('maxNonAdjacent([-5,-2]) returns 0')
    expect(maxNonAdjacent([4, 1, 1, 4])).toBe(8)
    expect(maxNonAdjacent([-5, -2])).toBe(0)
    expect(maxNonAdjacent([4, 5, 4])).toBe(8)
    expect(maxNonAdjacent([])).toBe(0)
    expect(maxNonAdjacent([7])).toBe(7)
    expect(maxNonAdjacent([0, 0])).toBe(0)
    expect(maxNonAdjacent(new Array<number>(100000).fill(1000000))).toBe(50000000000)
  })

  it('checks rolling DP against exhaustive nonadjacent selections', () => {
    for (let encoded = 0; encoded < 243; encoded++) {
      let digits = encoded
      const values = Array.from({ length: 5 }, () => {
        const value = (digits % 3) * 3 - 2
        digits = Math.floor(digits / 3)
        return value
      })
      let optimum = 0
      for (let mask = 0; mask < 1 << values.length; mask++) {
        if (mask & (mask << 1)) continue
        const sum = values.reduce((total, value, i) => total + ((mask & (1 << i)) ? value : 0), 0)
        optimum = Math.max(optimum, sum)
      }
      expect(maxNonAdjacent(values)).toBe(optimum)
    }
  })

  it('counts grid paths without leaking through obstacles or overflowing 32-bit counts', () => {
    expect(content('dp-grid-paths').example).toContain('countGridPaths([[0,0,0],[0,1,0],[0,0,0]]) returns 2')
    const blocked = [[0, 0, 0], [0, 1, 0], [0, 0, 0]]
    const snapshot = structuredClone(blocked)
    expect(countGridPaths(blocked)).toBe(2)
    expect(blocked).toEqual(snapshot)
    expect(countGridPaths([])).toBe(0)
    expect(countGridPaths([[]])).toBe(0)
    expect(countGridPaths([[0]])).toBe(1)
    expect(countGridPaths([[1]])).toBe(0)
    expect(countGridPaths([[1, 0], [0, 0]])).toBe(0)
    expect(countGridPaths([[0, 0], [0, 1]])).toBe(0)
    expect(countGridPaths([[0, 1, 0]])).toBe(0)
    expect(countGridPaths([[0], [1], [0]])).toBe(0)
    expect(countGridPaths([[0, 0, 0], [0, 0, 0]])).toBe(3)
    expect(content('dp-grid-paths').solution).toContain('35345263800')
    expect(countGridPaths(Array.from({ length: 20 }, () => new Array<number>(20).fill(0)))).toBe(35345263800)
  })

  it('checks every 3-by-3 obstacle layout against direct path enumeration', () => {
    function enumerate(blocked: number[][], r = 0, c = 0): number {
      if (r >= blocked.length || c >= blocked[0].length || blocked[r][c]) return 0
      if (r === blocked.length - 1 && c === blocked[0].length - 1) return 1
      return enumerate(blocked, r + 1, c) + enumerate(blocked, r, c + 1)
    }
    for (let mask = 0; mask < 512; mask++) {
      const blocked = Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => (mask >> (r * 3 + c)) & 1))
      expect(countGridPaths(blocked)).toBe(enumerate(blocked))
    }
  })
})
