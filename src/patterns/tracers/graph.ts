import { parseGrid, parseOneInt } from './parse'
import type { GraphView } from './types'

export const MAX_GRAPH_NODES = 8
export const MAX_GRAPH_EDGES = 12

interface EdgeOptions {
  weighted?: boolean
  directed?: boolean
  maxEdges?: number
  maxWeight?: number
}

/** Parses "0-1, 1-2" (or "0-1:4" with weights) into edges between nodes 0 to n − 1. Returns an error message when it cannot. */
export function parseEdges(text: string | undefined, n: number, { weighted = false, directed = false, maxEdges = MAX_GRAPH_EDGES, maxWeight = 20 }: EdgeOptions = {}): number[][] | string {
  const parts = (text ?? '').trim().replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)
  if (parts.length > maxEdges) return `Use at most ${maxEdges} edges.`
  const pattern = weighted ? /^(\d+)-(\d+):(\d+)$/ : /^(\d+)-(\d+)$/
  const seen = new Set<string>()
  const edges: number[][] = []
  for (const part of parts) {
    const match = pattern.exec(part)
    if (!match) return weighted ? `“${part}” is not an edge like 0-1:4.` : `“${part}” is not an edge like 0-1.`
    const a = Number(match[1])
    const b = Number(match[2])
    if (a >= n || b >= n) return `Nodes go from 0 to ${n - 1}.`
    if (a === b) return `“${part}” joins a node to itself.`
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`
    if (seen.has(key)) return directed ? `Use at most one edge between ${a} and ${b}.` : `“${part}” is listed twice.`
    seen.add(key)
    if (weighted) {
      const w = Number(match[3])
      if (w < 1 || w > maxWeight) return `Keep weights between 1 and ${maxWeight}.`
      edges.push([a, b, w])
    } else edges.push([a, b])
  }
  return edges
}

export const edgesText = (edges: readonly number[][]) => edges.map(([a, b, w]) => w === undefined ? `${a}-${b}` : `${a}-${b}:${w}`).join(', ')

/** Random distinct edges. Directed edges mostly point from a smaller to a larger node, so most graphs have no cycle. */
export function randomEdges(rand: () => number, n: number, count: number, { weighted = false, directed = false, maxWeight = 9, backChance = 0.1 } = {}): number[][] {
  const pairs: [number, number][] = []
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b])
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  return pairs.slice(0, Math.min(count, pairs.length)).map(([a, b]) => {
    const [from, to] = directed ? (rand() < backChance ? [b, a] : [a, b]) : rand() < 0.5 ? [b, a] : [a, b]
    return weighted ? [from, to, 1 + Math.floor(rand() * maxWeight)] : [from, to]
  })
}

/** Places n nodes evenly round a circle, starting at the top. */
export function circleLayout(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    return { x: 0.5 + 0.5 * Math.cos(angle), y: 0.5 + 0.5 * Math.sin(angle) }
  })
}

interface GraphState {
  directed?: boolean
  current?: number
  frontier?: number[]
  visited?: number[]
  activeEdges?: number[]
  notes?: (string | undefined)[]
}

/** A circle-laid graph view of nodes 0 to n − 1. Weighted edges show their weight. */
export function graphView(name: string, label: string, n: number, edges: readonly number[][], state: GraphState = {}): GraphView {
  const spots = circleLayout(n)
  return {
    name,
    label,
    nodes: spots.map((spot, i) => ({ label: String(i), ...spot, ...(state.notes?.[i] !== undefined ? { note: state.notes[i] } : {}) })),
    edges: edges.map(([from, to, w]) => (w === undefined ? { from, to } : { from, to, label: String(w) })),
    directed: state.directed,
    current: state.current,
    frontier: state.frontier ? [...state.frontier] : undefined,
    visited: state.visited ? [...state.visited] : undefined,
    activeEdges: state.activeEdges,
  }
}

/** Parses the shared n and edges fields. Errors are keyed by field name. */
export function parseGraph(input: Record<string, string>, options: EdgeOptions = {}): { ok: true; n: number; edges: number[][] } | { ok: false; n: number; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const n = parseOneInt(input.n, 2, MAX_GRAPH_NODES)
  if (typeof n === 'string') errors.n = n
  const edges = parseEdges(input.edges, typeof n === 'number' ? n : MAX_GRAPH_NODES, options)
  if (typeof edges === 'string') errors.edges = edges
  return Object.keys(errors).length ? { ok: false, n: typeof n === 'number' ? n : MAX_GRAPH_NODES, errors } : { ok: true, n: n as number, edges: edges as number[][] }
}

/** A grid of 0s and 1s, at most 5 × 5. */
export function parseBinaryGrid(text: string | undefined): number[][] | string {
  const grid = parseGrid(text)
  if (typeof grid === 'string') return grid
  return grid.some(row => row.some(value => value !== 0 && value !== 1)) ? 'Use only 0 and 1.' : grid
}

export const randomBinaryGrid = (rand: () => number, chance: number) => {
  const rows = 2 + Math.floor(rand() * 4)
  const cols = 2 + Math.floor(rand() * 4)
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (rand() < chance ? 1 : 0)))
}