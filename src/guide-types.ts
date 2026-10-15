import type { Track } from './curriculum-types'

export const GUIDE_TOPICS = ['api', 'system-design', 'algorithms', 'code-quality', 'testing', 'security', 'databases', 'ml-production', 'llm-apps'] as const
export type GuideTopic = typeof GUIDE_TOPICS[number]
export const TOPIC_LABELS: Record<GuideTopic, string> = {
  api: 'API design',
  'system-design': 'System design',
  algorithms: 'Algorithm practice',
  'code-quality': 'Code review & clean code',
  testing: 'Testing strategy',
  security: 'Security',
  databases: 'Databases',
  'ml-production': 'ML in production',
  'llm-apps': 'LLM apps',
}
/** The study track each topic feeds: its quiz cards join that flashcard deck and its practice prompt joins that mock. */
export const TOPIC_TRACK: Record<GuideTopic, Track> = {
  api: 'system-design',
  'system-design': 'system-design',
  algorithms: 'dsa',
  'code-quality': 'dsa',
  testing: 'dsa',
  security: 'system-design',
  databases: 'system-design',
  'ml-production': 'ml',
  'llm-apps': 'ai',
}

export type GuideLevel = 'se' | 'sse'
export type GuideKind = 'guide' | 'case'

// ---- Diagrams ------------------------------------------------------------------------------
// Diagrams are data. src/components/Diagram.tsx renders them as inline SVG that takes every
// colour from theme tokens, so they follow the palette, dark mode and high contrast.

export const FLOW_NODE_KINDS = ['client', 'service', 'worker', 'cache', 'db', 'queue', 'storage', 'external', 'lb', 'cdn', 'note', 'state', 'decision', 'bad', 'good'] as const
export type FlowNodeKind = typeof FLOW_NODE_KINDS[number]
export const EDGE_STYLES = ['sync', 'async', 'reply', 'fail'] as const
export type EdgeStyle = typeof EDGE_STYLES[number]

export interface FlowNode {
  id: string
  label: string
  kind: FlowNodeKind
  /** Grid column 0-4 and row 0-5. */
  col: number
  row: number
  /** Optional second line, e.g. a technology or a number. */
  sub?: string
}
export interface FlowEdge {
  from: string
  to: string
  label?: string
  style?: EdgeStyle
}
export interface FlowBody {
  nodes: FlowNode[]
  edges: FlowEdge[]
}
export interface FlowStep {
  /** Indexes into edges that this step highlights. */
  edges: number[]
  text: string
}

interface DiagramBase {
  /** Kebab-case, unique within its entry. */
  id: string
  title: string
  /** One or two sentences a screen reader user hears instead of the picture. */
  alt: string
  /** Shown under the figure. Says what to notice. */
  caption: string
}
/** Architecture, data-flow and state machines. Kind `state` nodes draw as rounded states. */
export interface FlowDiagram extends DiagramBase, FlowBody {
  type: 'flow'
  /** Optional step-through: each step highlights some edges and explains them. */
  steps?: FlowStep[]
}
export interface SequenceActor { id: string; label: string }
export interface SequenceMessage {
  from: string
  to: string
  label: string
  style?: EdgeStyle
  /** Shown in the step-through when this message is active. */
  note?: string
}
/** A request flow. Every message is a step in the step-through. */
export interface SequenceDiagram extends DiagramBase {
  type: 'sequence'
  actors: SequenceActor[]
  messages: SequenceMessage[]
}
/** Before/after (anti-pattern vs better), drawn side by side on wide screens and stacked on narrow ones. */
export interface CompareDiagram extends DiagramBase {
  type: 'compare'
  before: FlowBody & { label: string }
  after: FlowBody & { label: string }
}
export interface ChartPoint { label: string; x: number; y: number; highlight?: boolean }
/** A trade-off chart: options placed on two axes scored 0-10. */
export interface ChartDiagram extends DiagramBase {
  type: 'chart'
  x: { label: string; low: string; high: string }
  y: { label: string; low: string; high: string }
  points: ChartPoint[]
}
export interface BarItem { label: string; value: number; highlight?: boolean }
/** Relative magnitudes, e.g. latency or cost. Values are illustrative unless the caption says otherwise. */
export interface BarsDiagram extends DiagramBase {
  type: 'bars'
  unit: string
  bars: BarItem[]
}
export const TIMELINE_KINDS = ['trigger', 'impact', 'detect', 'mitigate', 'resolve'] as const
export type TimelineKind = typeof TIMELINE_KINDS[number]
export interface TimelineEvent { at: string; label: string; kind: TimelineKind }
/** An incident or project timeline. `at` is free text such as "T+0", "Day 3" or "14:20 UTC". */
export interface TimelineDiagram extends DiagramBase {
  type: 'timeline'
  events: TimelineEvent[]
}
export type Diagram = FlowDiagram | SequenceDiagram | CompareDiagram | ChartDiagram | BarsDiagram | TimelineDiagram
export const DIAGRAM_TYPES = ['flow', 'sequence', 'compare', 'chart', 'bars', 'timeline'] as const

// ---- Entries --------------------------------------------------------------------------------

export const SNIPPET_LANGS = ['text', 'http', 'json', 'js', 'ts', 'py', 'sql', 'yaml', 'shell'] as const
export type SnippetLang = typeof SNIPPET_LANGS[number]
/** A code or design snippet. Exactly one of `code` or `diagram` (an id from the entry's diagrams). */
export interface Snippet { label: string; lang?: SnippetLang; code?: string; diagram?: string }
export interface GoodBad { title: string; bad: Snippet; good: Snippet; why: string }
export interface AntiPattern { title: string; bad: Snippet; better: Snippet; why: string }
export interface QuizItem { question: string; choices: string[]; answer: number; explain: string }
export interface Practice { prompt: string; answer: string; rubric: string[] }
export interface GuideLinks { lessons?: string[]; problems?: string[]; cases?: string[]; guides?: string[] }
export interface Source { title: string; publisher: string; url: string; date?: string }

interface EntryBase {
  id: string
  kind: GuideKind
  topic: GuideTopic
  level: GuideLevel
  title: string
  summary: string
  minutes: number
  diagrams: Diagram[]
  /** How to show this in an interview. */
  interview: string[]
  quiz: QuizItem[]
  /** An interview-style question for mock interviews, with a model answer and rubric. */
  practice: Practice
  links: GuideLinks
}
/** A best-practice guide: principle → why → good/bad → checklist → interview → quiz. */
export interface GuideEntry extends EntryBase {
  kind: 'guide'
  principle: string
  why: string
  examples: GoodBad[]
  checklist: string[]
  antipatterns: AntiPattern[]
}
/** A real-world case study, paraphrased from cited public sources. */
export interface CaseEntry extends EntryBase {
  kind: 'case'
  organisation: string
  year: number
  problem: string
  constraints: string[]
  decisions: { decision: string; tradeoff: string }[]
  failures: string
  lessons: string[]
  sources: Source[]
  /** What the public sources do not settle, worded cautiously. */
  caveats?: string
}
export type FieldGuideEntry = GuideEntry | CaseEntry
export type GuideSummary = Pick<FieldGuideEntry, 'id' | 'kind' | 'topic' | 'level' | 'title' | 'summary' | 'minutes'> & {
  diagrams: number
  antipatterns: number
  quiz: number
  links: GuideLinks
  organisation?: string
}
