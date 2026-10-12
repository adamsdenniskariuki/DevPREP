export type CaseLevel = 'se' | 'sse'
export type NodeKind = 'client' | 'cdn' | 'lb' | 'service' | 'worker' | 'cache' | 'db' | 'queue' | 'storage' | 'external'
export const NODE_KINDS: readonly NodeKind[] = ['client', 'cdn', 'lb', 'service', 'worker', 'cache', 'db', 'queue', 'storage', 'external']
export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  client: 'Client', cdn: 'CDN / edge', lb: 'Load balancer', service: 'Service', worker: 'Worker',
  cache: 'Cache', db: 'Database', queue: 'Queue / stream', storage: 'Object storage', external: 'External',
}

export const STEP_KEYS = ['requirements', 'estimation', 'api', 'data', 'design', 'deepDives', 'bottlenecks', 'tradeoffs'] as const
export type StepKey = typeof STEP_KEYS[number]

export interface DiagramNode { id: string; kind: NodeKind; label: string; col: number; row: number }
export interface DiagramEdge { from: string; to: string; label?: string }
export interface RubricItem { text: string; sse?: true }

/** A system design case study from content/cases/<id>.json. */
export interface DesignCase {
  id: string
  title: string
  level: CaseLevel
  minutes: number
  summary: string
  prompt: string
  lessons: string[]
  steps: Record<StepKey, string[]>
  diagram: { nodes: DiagramNode[]; edges: DiagramEdge[] }
  rubric: RubricItem[]
}
export type CaseSummary = Pick<DesignCase, 'id' | 'title' | 'level' | 'minutes' | 'summary'>
