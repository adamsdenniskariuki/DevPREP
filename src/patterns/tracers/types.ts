/** A value shown in the variables panel. */
export type VarValue = string | number | boolean | null

export interface ArrayView {
  name: string
  label: string
  values: (number | string)[]
  /** Named pointers drawn under cells. Names are text, so they never rely on colour alone. */
  pointers?: { name: string; index: number }[]
  /** Inclusive [lo, hi] range drawn as a window. */
  window?: [number, number]
  /** Cells to emphasise, e.g. a found pair. */
  marked?: number[]
}

export interface MapView {
  label: string
  entries: [string, string][]
  /** Key of the entry this step reads or writes. */
  highlight?: string
}

/** A singly linked list drawn as nodes. Node i holds values[i]; next[i] is the index it points at, or null. */
export interface ListView {
  name: string
  label: string
  values: (number | string)[]
  next: (number | null)[]
  /** Index of the first node, or null for an empty list. Defaults to 0. */
  head?: number | null
  /** Named pointers drawn under nodes. */
  pointers?: { name: string; index: number }[]
  /** Nodes to emphasise, e.g. the answer. */
  marked?: number[]
  /** Nodes no longer in the list, e.g. removed ones. */
  dropped?: number[]
}

export interface TreeViewNode {
  label: string
  /** Child indexes in order. A null keeps an empty slot, so a binary tree still shows left and right. */
  children: (number | null)[]
  /** Ends a word in a trie. Drawn as a square instead of a circle. */
  end?: boolean
}

/** A rooted tree drawn top-down. Node 0 is the root. */
export interface TreeView {
  name: string
  label: string
  nodes: TreeViewNode[]
  /** Named pointers drawn under nodes. */
  pointers?: { name: string; index: number }[]
  /** Nodes in play: on the call stack, in the queue or on the current path. */
  active?: number[]
  /** Nodes that are finished, e.g. already output. */
  marked?: number[]
}

/** A small matrix drawn as a grid of cells. */
export interface GridView {
  name: string
  label: string
  cells: (number | string)[][]
  /** [row, col] of the cell this step reads. */
  current?: [number, number]
  /** Cells already visited. */
  visited?: [number, number][]
}

export interface TraceView {
  arrays: ArrayView[]
  lists?: ListView[]
  trees?: TreeView[]
  grids?: GridView[]
  map?: MapView
}

export interface TraceFrame {
  /** Marker key of the code line this step runs (see stripMarkers). */
  line: string
  /** Plain-English description of the step; also the text alternative. */
  text: string
  vars: Record<string, VarValue>
  view: TraceView
}

export interface Trace {
  frames: TraceFrame[]
  result: unknown
}

export interface TracerParam {
  name: string
  label: string
  kind: 'ints' | 'int' | 'text'
}

export type ParseResult = { ok: true; args: unknown[] } | { ok: false; errors: Record<string, string> }

export interface Tracer {
  id: string
  params: TracerParam[]
  /** Validates custom input against small limits and returns the function arguments. */
  parse: (input: Record<string, string>) => ParseResult
  run: (args: unknown[]) => Trace
  /** A random valid input, for tests. */
  random: (rand: () => number) => Record<string, string>
}
