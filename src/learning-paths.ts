import { lessons } from './curriculum'
import type { Progress } from './progress'

export type PathId = 'swe' | 'senior'

export interface PathPhase {
  title: string
  objective: string
  lessonIds: string[]
}

export interface PathPrompt {
  lessonId: string
  title: string
  prompt: string
  rubric: string[]
  discussion: string
}

export interface LearningPath {
  id: PathId
  title: string
  shortTitle: string
  audience: string
  emphasis: string
  outcomes: string[]
  phases: PathPhase[]
  prompts: PathPrompt[]
}

export const learningPaths: LearningPath[] = [
  {
    id: 'swe',
    title: 'Software Engineer',
    shortTitle: 'SWE',
    audience: 'For engineers building or rebuilding a foundation for coding, core design, and explaining their work.',
    emphasis: 'Coding patterns first, then a bounded service design and clear technical communication.',
    outcomes: [
      'Choose a data structure, state an invariant, and explain time and space costs.',
      'Trace an API request through storage and caching with explicit assumptions.',
      'Describe genuine contributions and communicate an approach under interview constraints.',
    ],
    phases: [
      {
        title: 'Build programming foundations',
        objective: 'Practice precise contracts, lookup strategies, and boundary reasoning before larger structures.',
        lessonIds: ['arrays-prefix-foundations', 'hash-map-complements', 'two-pointers-sorted-pairs', 'stack-balanced-delimiters', 'binary-search-lower-bound'],
      },
      {
        title: 'Explain your contribution',
        objective: 'Prepare truthful evidence of ownership and tradeoffs alongside your coding work.',
        lessonIds: ['behavioral-star-evidence', 'behavioral-ownership-impact', 'behavioral-tradeoffs-conflict'],
      },
      {
        title: 'Work with structures and search',
        objective: 'Extend your invariants to mutable structures, recursion, ordered data, and graph traversal.',
        lessonIds: ['sliding-window-distinct', 'queues-fifo-simulation', 'linked-lists-reversal', 'sorting-stable-merge', 'recursion-fast-power', 'trees-bst-validation', 'heaps-top-k', 'graph-bfs-shortest-hops', 'graph-dfs-components'],
      },
      {
        title: 'Choose and justify an algorithm',
        objective: 'Distinguish exhaustive search, a provable greedy choice, and reusable subproblem results.',
        lessonIds: ['backtracking-subsets', 'greedy-interval-selection', 'dp-nonadjacent-sum'],
      },
      {
        title: 'Design a small service',
        objective: 'Bound requirements, define a retry-safe API, and connect a query model to indexes and caching.',
        lessonIds: ['design-requirements-capacity', 'design-api-data-model', 'design-databases-indexes', 'design-cache-data-flow'],
      },
      {
        title: 'Communicate decisions and learning',
        objective: 'Build toward a project deep dive and a clear technical explanation. Leadership topics are supporting prerequisites here, not a senior-level credential.',
        lessonIds: ['behavioral-failure-learning', 'behavioral-ambiguity-prioritization', 'behavioral-collaboration-leadership', 'behavioral-project-deep-dive', 'behavioral-technical-communication'],
      },
    ],
    prompts: [],
  },
  {
    id: 'senior',
    title: 'Senior Software Engineer',
    shortTitle: 'Senior SWE',
    audience: 'For engineers with implementation experience who want to practice broader design decisions, ambiguity, operational ownership, and influence.',
    emphasis: 'Frame uncertainty early, refresh coding fundamentals, then spend more time on distributed-system tradeoffs and leadership.',
    outcomes: [
      'Turn an ambiguous request into a bounded decision, with explicit assumptions and evidence that could change it.',
      'Explain consistency, capacity, and failure tradeoffs across an end-to-end design.',
      'Discuss operational risk, rollout ownership, and collaboration using genuine experience rather than invented scope.',
    ],
    phases: [
      {
        title: 'Frame the problem and your responsibility',
        objective: 'Start with requirements and evidence of ownership. Practice naming uncertainty before committing to an architecture.',
        lessonIds: ['design-requirements-capacity', 'behavioral-star-evidence', 'behavioral-ownership-impact', 'behavioral-tradeoffs-conflict', 'behavioral-failure-learning', 'behavioral-ambiguity-prioritization'],
      },
      {
        title: 'Refresh coding with explicit invariants',
        objective: 'Revisit a selected set of foundations through trees, heaps, and BFS. Existing completions count; other algorithms remain available as supplemental practice.',
        lessonIds: ['arrays-prefix-foundations', 'hash-map-complements', 'two-pointers-sorted-pairs', 'stack-balanced-delimiters', 'queues-fifo-simulation', 'linked-lists-reversal', 'binary-search-lower-bound', 'sorting-stable-merge', 'recursion-fast-power', 'trees-bst-validation', 'heaps-top-k', 'graph-bfs-shortest-hops'],
      },
      {
        title: 'Make distributed-system tradeoffs',
        objective: 'Move from contracts and queries to distribution, consistency, asynchronous work, and capacity protection.',
        lessonIds: ['design-api-data-model', 'design-databases-indexes', 'design-cache-data-flow', 'design-replication-partitioning', 'design-consistency', 'design-queues-events', 'design-rate-limiting'],
      },
      {
        title: 'Operate the system and lead the work',
        objective: 'Define observable service promises, make rollout risk explicit, and explain how people coordinate delivery.',
        lessonIds: ['design-reliability-observability', 'behavioral-collaboration-leadership', 'behavioral-project-deep-dive'],
      },
      {
        title: 'Synthesize and defend a decision',
        objective: 'Integrate the service design, revisit assumptions under follow-up questions, and communicate clearly within a time budget.',
        lessonIds: ['design-end-to-end-bookmarks', 'behavioral-technical-communication'],
      },
    ],
    prompts: [
      {
        lessonId: 'design-requirements-capacity',
        title: 'Negotiate scope before committing',
        prompt: 'A team asks for a bookmark service in six weeks. Product wants offline edits, security needs tenant isolation, and support wants an audit trail. Two engineers can work on it; no usage measurements exist yet. In a five-minute design discussion, identify the three questions you would resolve first, propose a smallest safe first release, and name one reversible decision and one expensive-to-reverse decision. Do not invent traffic estimates as facts: label a provisional workload and explain how you would measure it. Use the core lesson’s capacity method once the assumptions are explicit.',
        rubric: [
          'Separate essential safety constraints from negotiable feature scope and identify who decides.',
          'Give a bounded first release, explicit exclusions, and a check-in that could change the plan.',
          'Label estimated inputs and show how an incorrect estimate changes capacity or scope.',
          'Distinguish a reversible implementation choice from a persistent data or contract decision.',
        ],
        discussion: 'One defensible first release is online-only private bookmarks with authenticated tenant-scoped access and an audit mechanism agreed with security. Offline editing is deferred until conflict resolution and support costs are understood; this is a proposal to negotiate, not permission to drop a requirement unilaterally. Ask about tenancy boundaries, audit obligations, and expected user operations before picking storage. A cache policy is relatively reversible; a public identifier or retained data contract can be costly to change. Use a provisional workload to estimate a range, then validate it through product evidence and a small instrumented trial. State what evidence would make you reconsider the release rather than promising the date regardless of risk.',
      },
      {
        lessonId: 'design-reliability-observability',
        title: 'Own the rollout and the failure',
        prompt: 'You propose moving bookmark reads to a new index while the old store remains authoritative. Writes continue during backfill, and an update may reach the new index late or twice. Explain a staged rollout, how you detect missing or stale results, the condition that stops promotion, and the rollback boundary. Your team has one on-call engineer and no appetite for an unbounded dual-write period. Treat this as a hypothetical design exercise, not a claim that you have led this migration.',
        rubric: [
          'Specify how backfill and live updates meet, including ordering, idempotency, and reconciliation.',
          'Choose user-visible correctness and latency signals, not only infrastructure health.',
          'Assign rollout and rollback ownership and define a measurable stop condition.',
          'Explain which state can be rolled back and how the old read path remains trustworthy.',
        ],
        discussion: 'Start with a versioned backfill boundary and a durable update stream or another mechanism whose replay behavior is explicit. Apply updates idempotently by entity and version, and reconcile against the source rather than assuming a successful queue acknowledgement proves index correctness. Compare sampled shadow reads before a small tenant-scoped canary; measure missing results, staleness, and tail latency against agreed tolerances. Keep the old store authoritative and the old read path available until reconciliation and operational handoff are complete. Rollback may switch reads without undoing user writes, but only if writes never became dependent on the new index. Set an owner, a bounded observation period, and a retirement criterion; a feature flag alone does not make a data migration reversible.',
      },
      {
        lessonId: 'behavioral-collaboration-leadership',
        title: 'Influence without inventing authority',
        prompt: 'Choose a real example where a dependency or disagreement put shared delivery at risk. Explain what you owned, what belonged to another team, and how you made the decision easier without claiming their work. Then discuss this hypothetical follow-up: the other team cannot meet the date and your manager still wants the release. What options, risks, and escalation would you present? If you have not led a cross-team project, use a smaller collaboration honestly and distinguish your real actions from the hypothetical response.',
        rubric: [
          'Separate your actual role and evidence from the hypothetical extension.',
          'Represent the dependency owner’s constraints fairly and give credit explicitly.',
          'Offer options with customer impact, risk, and decision ownership rather than only escalating blame.',
          'Identify what you learned and how you would confirm that the working agreement helped.',
        ],
        discussion: 'A useful answer can come from a modest project. Describe the shared goal, your observable actions, and the other people’s contributions, using evidence you actually have. In the hypothetical follow-up, options might be a smaller release, a temporary integration boundary with explicit costs, or a changed date. Surface reliability or safety constraints that cannot be traded away, and ask the accountable decision-maker to choose among documented options. Clarify ownership and communicate the decision back to affected teams. Avoid inventing metrics or presenting a manager’s final decision as your unilateral authority. Senior-oriented practice is about judgment and scope awareness, not inflating the story.',
      },
    ],
  },
]

export function isPathId(value: unknown): value is PathId {
  return value === 'swe' || value === 'senior'
}

export function getLearningPath(id: PathId | undefined): LearningPath | undefined {
  return learningPaths.find(path => path.id === id)
}

export function pathLessonIds(path: LearningPath): string[] {
  return path.phases.flatMap(phase => phase.lessonIds)
}

export function pathProgress(path: LearningPath, progress: Pick<Progress, 'records'>) {
  const ids = pathLessonIds(path)
  const completed = ids.filter(id => Object.hasOwn(progress.records, id)).length
  return { completed, total: ids.length, percent: Math.round(completed / ids.length * 100) }
}

export function nextLessonFor(progress: Pick<Progress, 'records' | 'selectedPath'>) {
  const path = getLearningPath(progress.selectedPath)
  if (!path) return lessons.find(lesson => !Object.hasOwn(progress.records, lesson.id))
  const id = pathLessonIds(path).find(id => !Object.hasOwn(progress.records, id))
  return lessons.find(lesson => lesson.id === id)
}

export function selectPath(progress: Progress, id: PathId | undefined): Progress {
  const next = { ...progress }
  if (id === undefined) delete next.selectedPath
  else next.selectedPath = id
  return next
}
