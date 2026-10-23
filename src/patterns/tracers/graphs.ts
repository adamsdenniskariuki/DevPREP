import { edgesText, graphView, parseBinaryGrid, parseGraph, randomBinaryGrid, randomEdges } from './graph'
import { gridText, parseOneInt } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

const graphParams = [
  { name: 'n', label: 'Number of nodes (2 to 8)', kind: 'int' as const },
  { name: 'edges', label: 'Edges, like 0-1, 1-2', kind: 'text' as const },
]

const randomGraph = (rand: () => number, options: { weighted?: boolean; directed?: boolean; backChance?: number } = {}) => {
  const n = 3 + Math.floor(rand() * 5)
  return { n, edges: randomEdges(rand, n, 1 + Math.floor(rand() * (n + 2)), options) }
}

const adjacencyEntries = (adj: number[][][]): [string, string][] => adj.map((list, v) => [String(v), list.map(([u]) => u).join(', ') || '—'])

/** Graphs: build an adjacency list, then walk it with a stack or queue and a seen set. */
export const graphReach: Tracer = {
  id: 'graph-reach',
  params: [...graphParams, { name: 'start', label: 'Start node', kind: 'int' }],
  parse(input) {
    const graph = parseGraph(input)
    const errors: Record<string, string> = graph.ok ? {} : { ...graph.errors }
    const start = parseOneInt(input.start, 0, graph.n - 1)
    if (typeof start === 'string') errors.start = start
    return graph.ok && typeof start === 'number' ? { ok: true, args: [graph.n, graph.edges, start] } : { ok: false, errors }
  },
  run(args): Trace {
    const n = args[0] as number
    const edges = args[1] as number[][]
    const start = args[2] as number
    // adj[v] holds [neighbour, edge index] pairs, in the order the edges were read.
    const adj: number[][][] = Array.from({ length: n }, () => [])
    const seen = new Set<number>()
    const stack: number[] = []
    const order: number[] = []
    const frames: TraceFrame[] = []
    let node: number | null = null
    let next: number | null = null
    const snap = (line: string, text: string, activeEdges: number[] = []) => frames.push({
      line,
      text,
      vars: { node, next },
      view: {
        arrays: [
          { name: 'stack', label: 'stack (top on the right)', values: [...stack] },
          { name: 'order', label: 'order (visited)', values: [...order] },
        ],
        graphs: [graphView('graph', 'graph (double border = current, dashed = on the stack, filled = visited)', n, edges, { current: node ?? undefined, frontier: stack, visited: order, activeEdges })],
        map: { label: 'adjacency list', entries: adjacencyEntries(adj), highlight: node === null ? undefined : String(node) },
      },
    })
    snap('init', `Make an empty neighbour list for each of the ${n} nodes.`)
    edges.forEach(([a, b], index) => {
      adj[a].push([b, index])
      adj[b].push([a, index])
      snap('build', `Edge ${a}-${b} has no direction, so add ${b} to ${a}'s list and ${a} to ${b}'s list.`, [index])
    })
    seen.add(start)
    stack.push(start)
    snap('start', `Push the start node ${start} and mark it as seen, so it is never pushed twice.`)
    while (stack.length) {
      node = stack.pop()!
      next = null
      order.push(node)
      snap('pop', `Pop ${node} from the top of the stack and visit it. Order so far: [${order.join(', ')}].`)
      for (const [u, index] of adj[node]) {
        next = u
        if (seen.has(u)) {
          snap('check', `Neighbour ${u} is already seen, so skip it.`, [index])
          continue
        }
        snap('check', `Neighbour ${u} is new.`, [index])
        seen.add(u)
        stack.push(u)
        snap('push', `Mark ${u} as seen and push it onto the stack.`, [index])
      }
    }
    node = null
    next = null
    const missed = n - order.length
    snap('done', `The stack is empty. ${order.length} node${order.length === 1 ? '' : 's'} can be reached from ${start}${missed ? `; ${missed} cannot` : ''}. Return [${order.join(', ')}].`)
    return { frames, result: order }
  },
  random(rand) {
    const { n, edges } = randomGraph(rand)
    return { n: String(n), edges: edgesText(edges), start: String(Math.floor(rand() * n)) }
  },
}

const DIRECTIONS = ['down', 'up', 'right', 'left']
const DR = [1, -1, 0, 0]
const DC = [0, 0, 1, -1]

/** BFS on a grid: the first time the queue reaches a cell is along a shortest path. */
export const gridBfs: Tracer = {
  id: 'grid-bfs',
  params: [{ name: 'grid', label: 'Grid rows of 0 (open) and 1 (wall), separated by /', kind: 'text' }],
  parse(input) {
    const grid = parseBinaryGrid(input.grid)
    return typeof grid === 'string' ? { ok: false, errors: { grid } } : { ok: true, args: [grid] }
  },
  run(args): Trace {
    const grid = args[0] as number[][]
    const rows = grid.length
    const cols = grid[0].length
    const dist = grid.map(row => row.map(() => -1))
    const queue: [number, number][] = []
    const done: [number, number][] = []
    const frames: TraceFrame[] = []
    let head = 0
    let cell: [number, number] | undefined
    let near: [number, number] | null = null
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { r: cell ? cell[0] : null, c: cell ? cell[1] : null, nr: near ? near[0] : null, nc: near ? near[1] : null },
      view: {
        arrays: [{ name: 'queue', label: 'queue (front on the left)', values: queue.slice(head).map(([r, c]) => `${r},${c}`) }],
        grids: [{
          name: 'dist',
          label: 'steps from the top-left (# = wall, · = not reached; dashed = queued, filled = done)',
          cells: grid.map((row, r) => row.map((value, c) => (value === 1 ? '#' : dist[r][c] === -1 ? '·' : dist[r][c]))),
          current: cell,
          visited: [...done],
          frontier: queue.slice(head),
        }],
      },
    })
    snap('init', `The grid has ${rows} row${rows === 1 ? '' : 's'} and ${cols} column${cols === 1 ? '' : 's'}. Walk from the top-left to the bottom-right.`)
    if (grid[0][0] === 1 || grid[rows - 1][cols - 1] === 1) {
      snap('blocked', `The ${grid[0][0] === 1 ? 'start' : 'goal'} is a wall, so no path exists. Return -1.`)
      return { frames, result: -1 }
    }
    snap('blocked', 'Neither the start nor the goal is a wall.')
    dist[0][0] = 0
    queue.push([0, 0])
    snap('start', 'The start is 0 steps away. Put it in the queue.')
    while (head < queue.length) {
      cell = queue[head++]
      near = null
      const [r, c] = cell
      done.push(cell)
      snap('pop', `Take ${r},${c} from the front of the queue. It is ${dist[r][c]} step${dist[r][c] === 1 ? '' : 's'} away.`)
      if (r === rows - 1 && c === cols - 1) {
        snap('found', `This is the goal. BFS reaches cells in order of distance, so ${dist[r][c]} is the fewest steps. Return ${dist[r][c]}.`)
        return { frames, result: dist[r][c] }
      }
      for (let d = 0; d < 4; d++) {
        const nr = r + DR[d]
        const nc = c + DC[d]
        near = [nr, nc]
        const outside = nr < 0 || nr >= rows || nc < 0 || nc >= cols
        if (outside || grid[nr][nc] === 1 || dist[nr][nc] !== -1) {
          snap('check', `Look ${DIRECTIONS[d]} at ${nr},${nc}: ${outside ? 'outside the grid' : grid[nr][nc] === 1 ? 'a wall' : 'already reached'}, so skip it.`)
          continue
        }
        dist[nr][nc] = dist[r][c] + 1
        queue.push([nr, nc])
        snap('push', `Look ${DIRECTIONS[d]} at ${nr},${nc}: open and new. It is ${dist[nr][nc]} step${dist[nr][nc] === 1 ? '' : 's'} away; add it to the back of the queue.`)
      }
    }
    cell = undefined
    near = null
    snap('done', 'The queue is empty and the goal was never reached, so walls cut it off. Return -1.')
    return { frames, result: -1 }
  },
  random(rand) {
    return { grid: gridText(randomBinaryGrid(rand, 0.25)) }
  },
}

/** DFS flood fill: each unvisited land cell starts a new island, and the recursion sinks all of it. */
export const floodFill: Tracer = {
  id: 'flood-fill',
  params: [{ name: 'grid', label: 'Grid rows of 1 (land) and 0 (water), separated by /', kind: 'text' }],
  parse(input) {
    const grid = parseBinaryGrid(input.grid)
    return typeof grid === 'string' ? { ok: false, errors: { grid } } : { ok: true, args: [grid] }
  },
  run(args): Trace {
    const grid = args[0] as number[][]
    const g = grid.map(row => [...row])
    const rows = g.length
    const cols = g[0].length
    const calls: [number, number][] = []
    const sunk: [number, number][] = []
    const frames: TraceFrame[] = []
    let count = 0
    let at: [number, number] | undefined
    const inside = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { r: at ? at[0] : null, c: at ? at[1] : null, count },
      view: {
        arrays: [{ name: 'calls', label: 'call stack of sink (r,c), innermost on the right', values: calls.map(([r, c]) => `${r},${c}`) }],
        grids: [{
          name: 'g',
          label: 'g (1 = land, 0 = water, 2 = sunk; dashed = on the call stack)',
          cells: g.map(row => [...row]),
          current: at && inside(at[0], at[1]) ? at : undefined,
          visited: [...sunk],
          frontier: calls.filter(([r, c]) => inside(r, c)),
        }],
      },
    })
    const sink = (r: number, c: number, from: string) => {
      calls.push([r, c])
      at = [r, c]
      if (!inside(r, c) || g[r][c] !== 1) {
        snap('base', `sink(${r}, ${c}) ${from}: ${!inside(r, c) ? 'outside the grid' : g[r][c] === 0 ? 'water' : 'already sunk'}, so return.`)
        calls.pop()
        return
      }
      g[r][c] = 2
      sunk.push([r, c])
      snap('mark', `sink(${r}, ${c}) ${from}: land. Mark it 2 so it is never counted again.`)
      snap('recurse', `Call sink on the four neighbours of ${r},${c}: down, up, right, then left.`)
      for (let d = 0; d < 4; d++) {
        sink(r + DR[d], c + DC[d], `(${DIRECTIONS[d]} from ${r},${c})`)
        at = [r, c]
      }
      calls.pop()
    }
    snap('init', 'Copy the grid so the input is not changed. Then scan every cell, row by row.')
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      at = [r, c]
      if (g[r][c] !== 1) {
        snap('scan', `Cell ${r},${c} is ${g[r][c] === 0 ? 'water' : 'part of an island already sunk'}. Skip it.`)
        continue
      }
      count++
      snap('found', `Cell ${r},${c} is unvisited land, so it starts island ${count}. Sink the whole island from here.`)
      sink(r, c, '(the first cell)')
      at = [r, c]
    }
    at = undefined
    snap('done', `Every cell has been scanned. There ${count === 1 ? 'is 1 island' : `are ${count} islands`}. Return ${count}.`)
    return { frames, result: count }
  },
  random(rand) {
    return { grid: gridText(randomBinaryGrid(rand, 0.5)) }
  },
}

/** Topological sort (Kahn): repeatedly take a node with no unmet prerequisites. */
export const kahn: Tracer = {
  id: 'kahn',
  params: [graphParams[0], { name: 'edges', label: 'Directed edges, like 0-1 for 0 → 1', kind: 'text' }],
  parse(input) {
    const graph = parseGraph(input, { directed: true })
    return graph.ok ? { ok: true, args: [graph.n, graph.edges] } : { ok: false, errors: graph.errors }
  },
  run(args): Trace {
    const n = args[0] as number
    const edges = args[1] as number[][]
    const adj: number[][][] = Array.from({ length: n }, () => [])
    const indeg = Array<number>(n).fill(0)
    const queue: number[] = []
    const order: number[] = []
    const frames: TraceFrame[] = []
    let head = 0
    let v: number | null = null
    let w: number | null = null
    const snap = (line: string, text: string, activeEdges: number[] = []) => frames.push({
      line,
      text,
      vars: { v, w },
      view: {
        arrays: [
          { name: 'indeg', label: 'indeg (arrows still coming in)', values: [...indeg], ...(w !== null ? { pointers: [{ name: 'w', index: w }] } : {}) },
          { name: 'queue', label: 'queue (front on the left)', values: queue.slice(head) },
          { name: 'order', label: 'order', values: [...order] },
        ],
        graphs: [graphView('graph', 'graph (note = in-degree; dashed = queued, filled = taken)', n, edges, { directed: true, current: v ?? undefined, frontier: queue.slice(head), visited: order, activeEdges, notes: indeg.map(k => `in ${k}`) })],
      },
    })
    snap('init', `Make an empty out-list and an in-degree of 0 for each of the ${n} nodes.`)
    edges.forEach(([a, b], index) => {
      adj[a].push([b, index])
      indeg[b]++
      snap('build', `Edge ${a} → ${b}: ${b} must come after ${a}. Add ${b} to ${a}'s list; ${b} now has ${indeg[b]} arrow${indeg[b] === 1 ? '' : 's'} in.`, [index])
    })
    for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i)
    snap('seed', queue.length ? `Nodes with nothing coming in can go first: queue [${queue.join(', ')}].` : 'Every node has an arrow coming in, so nothing can go first.')
    while (head < queue.length) {
      v = queue[head++]
      w = null
      order.push(v)
      snap('pop', `Take ${v} from the queue and add it to the order: [${order.join(', ')}].`)
      for (const [u, index] of adj[v]) {
        w = u
        indeg[u]--
        snap('drop', `${v} is placed, so the arrow ${v} → ${u} is met. ${u} has ${indeg[u]} arrow${indeg[u] === 1 ? '' : 's'} left.`, [index])
        if (indeg[u] === 0) {
          queue.push(u)
          snap('ready', `${u} has nothing left to wait for. Add it to the queue.`, [index])
        }
      }
    }
    v = null
    w = null
    if (order.length === n) snap('done', `All ${n} nodes are placed. Return [${order.join(', ')}].`)
    else snap('done', `Only ${order.length} of ${n} nodes were placed. The rest wait on each other in a cycle, so return [].`)
    return { frames, result: order.length === n ? order : [] }
  },
  random(rand) {
    const { n, edges } = randomGraph(rand, { directed: true, backChance: 0.15 })
    return { n: String(n), edges: edgesText(edges) }
  },
}

/** Union-Find: each group is a tree; find walks to the root, union hangs the smaller root under the larger. */
export const unionFind: Tracer = {
  id: 'union-find',
  params: graphParams,
  parse(input) {
    const graph = parseGraph(input)
    return graph.ok ? { ok: true, args: [graph.n, graph.edges] } : { ok: false, errors: graph.errors }
  },
  run(args): Trace {
    const n = args[0] as number
    const edges = args[1] as number[][]
    const parent = Array.from({ length: n }, (_, i) => i)
    const size = Array<number>(n).fill(1)
    const frames: TraceFrame[] = []
    let groups = n
    let edge = -1
    let x: number | null = null
    let ra: number | null = null
    let rb: number | null = null
    const snap = (line: string, text: string) => {
      const forest = parent.flatMap((p, i) => (p === i ? [] : [[i, p]]))
      const roots = parent.flatMap((p, i) => (p === i ? [i] : []))
      frames.push({
        line,
        text,
        vars: { x, ra, rb, groups },
        view: {
          arrays: [
            { name: 'edges', label: 'edges', values: edges.map(([a, b]) => `${a}-${b}`), ...(edge >= 0 ? { pointers: [{ name: 'edge', index: edge }] } : {}) },
            { name: 'parent', label: 'parent', values: [...parent], ...(x !== null ? { pointers: [{ name: 'x', index: x }] } : {}) },
            { name: 'size', label: 'size (only read at roots)', values: [...size] },
          ],
          graphs: [graphView('forest', 'parent forest (arrow = child to parent, filled = root)', n, forest, { directed: true, current: x ?? undefined, visited: roots, notes: parent.map((p, i) => (p === i ? `size ${size[i]}` : undefined)) })],
        },
      })
    }
    const find = (start: number) => {
      x = start
      while (parent[x] !== x) {
        const was = parent[x]
        parent[x] = parent[parent[x]]
        snap('hop', parent[x] === was ? `${x} is not a root, but its parent ${was} is. Move up to ${was}.` : `${x} is not a root. Point it at its grandparent ${parent[x]} (was ${was}) to halve the path, then move there.`)
        x = parent[x]
      }
      snap('root', `${x} is its own parent, so it is the root of ${start}'s group.`)
      const root = x
      x = null
      return root
    }
    snap('init', `Every node starts as its own group of size 1, so there are ${n} groups.`)
    edges.forEach(([a, b], index) => {
      edge = index
      ra = null
      rb = null
      snap('edge', `Edge ${a}-${b}: find the root of each end.`)
      ra = find(a)
      rb = find(b)
      if (ra === rb) {
        snap('same', `Both ends have root ${ra}: they are already in one group, so skip this edge.`)
        return
      }
      snap('same', `The roots ${ra} and ${rb} differ, so this edge joins two groups.`)
      if (size[ra] < size[rb]) {
        ;[ra, rb] = [rb, ra]
        snap('size', `Swap so ra is the larger root: ra = ${ra} (size ${size[ra]}), rb = ${rb} (size ${size[rb]}).`)
      } else snap('size', `ra = ${ra} (size ${size[ra]}) is at least as large as rb = ${rb} (size ${size[rb]}), so no swap.`)
      parent[rb] = ra
      size[ra] += size[rb]
      groups--
      snap('union', `Hang ${rb} under ${ra}. The group now has ${size[ra]} nodes, and there are ${groups} group${groups === 1 ? '' : 's'}.`)
    })
    edge = -1
    ra = null
    rb = null
    snap('done', `All edges are read. Return ${groups}.`)
    return { frames, result: groups }
  },
  random(rand) {
    const { n, edges } = randomGraph(rand)
    return { n: String(n), edges: edgesText(edges) }
  },
}

/** Dijkstra: always settle the closest unsettled node; its distance can no longer improve. */
export const dijkstra: Tracer = {
  id: 'dijkstra',
  params: [graphParams[0], { name: 'edges', label: 'Directed weighted edges, like 0-1:4', kind: 'text' }, { name: 'src', label: 'Source node', kind: 'int' }],
  parse(input) {
    const graph = parseGraph(input, { weighted: true, directed: true })
    const errors: Record<string, string> = graph.ok ? {} : { ...graph.errors }
    const src = parseOneInt(input.src, 0, graph.n - 1)
    if (typeof src === 'string') errors.src = src
    return graph.ok && typeof src === 'number' ? { ok: true, args: [graph.n, graph.edges, src] } : { ok: false, errors }
  },
  run(args): Trace {
    const n = args[0] as number
    const edges = args[1] as number[][]
    const src = args[2] as number
    const adj: number[][][] = Array.from({ length: n }, () => [])
    const dist = Array<number>(n).fill(Infinity)
    const settled: number[] = []
    let pq: [number, number][] = []
    const frames: TraceFrame[] = []
    let v: number | null = null
    let u: number | null = null
    const show = (d: number) => (d === Infinity ? '∞' : d)
    const snap = (line: string, text: string, activeEdges: number[] = []) => frames.push({
      line,
      text,
      vars: { v, u },
      view: {
        arrays: [
          { name: 'pq', label: 'pq (node:distance, nearest first)', values: pq.map(([d, node]) => `${node}:${d}`) },
          { name: 'dist', label: 'dist', values: dist.map(show), ...(v !== null ? { pointers: [{ name: 'v', index: v }] } : {}) },
        ],
        graphs: [graphView('graph', 'graph (edge label = weight, note = best distance; dashed = in pq, filled = settled)', n, edges, {
          directed: true,
          current: v ?? undefined,
          frontier: [...new Set(pq.map(([, node]) => node))],
          visited: settled,
          activeEdges,
          notes: dist.map(d => `d=${show(d)}`),
        })],
      },
    })
    snap('init', `Every distance starts at ∞ (not reached). Make an out-list for each of the ${n} nodes.`)
    edges.forEach(([a, b, w], index) => {
      adj[a].push([b, w, index])
      snap('build', `Road ${a} → ${b} takes ${w}. Add it to ${a}'s list.`, [index])
    })
    dist[src] = 0
    pq = [[0, src]]
    snap('start', `The source ${src} is 0 away. Put it in the priority queue.`)
    while (pq.length) {
      const [d, node] = pq.shift()!
      v = node
      u = null
      snap('pop', `Take the nearest entry: node ${node} at distance ${d}.`)
      if (d > dist[node]) {
        snap('stale', `This entry is stale: ${node} was already reached in ${dist[node]}. Skip it.`)
        continue
      }
      settled.push(node)
      snap('stale', `${d} is ${node}'s best distance, so ${node} is settled. Nothing closer is left to improve it.`)
      for (const [next, w, index] of adj[node]) {
        u = next
        if (d + w >= dist[next]) {
          snap('relax', `Via ${node}, ${next} would be ${d} + ${w} = ${d + w}, which is no better than ${show(dist[next])}. Skip it.`, [index])
          continue
        }
        snap('relax', `Via ${node}, ${next} would be ${d} + ${w} = ${d + w}, better than ${show(dist[next])}.`, [index])
        dist[next] = d + w
        pq.push([dist[next], next])
        pq.sort((x, y) => x[0] - y[0] || x[1] - y[1])
        snap('push', `Set dist[${next}] = ${dist[next]} and add ${next} to the priority queue.`, [index])
      }
    }
    v = null
    u = null
    const result = dist.map(d => (d === Infinity ? -1 : d))
    snap('done', `The queue is empty. Unreached nodes become -1. Return [${result.join(', ')}].`)
    return { frames, result }
  },
  random(rand) {
    const { n, edges } = randomGraph(rand, { weighted: true, directed: true, backChance: 0.3 })
    return { n: String(n), edges: edgesText(edges), src: String(Math.floor(rand() * n)) }
  },
}
