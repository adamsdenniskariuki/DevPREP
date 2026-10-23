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

export interface TraceView {
  arrays: ArrayView[]
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
  kind: 'ints' | 'int'
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
