import type { StepKey } from './case-types'

export interface FrameworkStep {
  key: StepKey
  title: string
  /** Suggested share of a 45-minute interview. */
  minutes: number
  questions: string[]
}

/** The eight-step answer structure used by every case study, its notes and its model answer. */
export const DESIGN_FRAMEWORK: FrameworkStep[] = [
  { key: 'requirements', title: 'Requirements', minutes: 5, questions: ['Which features are in scope, and which are explicitly out?', 'What scale, latency, availability and consistency targets matter?'] },
  { key: 'estimation', title: 'Estimation', minutes: 4, questions: ['Requests per second on average and at peak?', 'Storage and bandwidth growth per day and per year?'] },
  { key: 'api', title: 'API', minutes: 4, questions: ['What are the main endpoints or messages, with inputs and outputs?', 'Which calls must be idempotent or paginated?'] },
  { key: 'data', title: 'Data model', minutes: 5, questions: ['What entities, keys and access patterns exist?', 'Which store fits each access pattern, and why?'] },
  { key: 'design', title: 'High-level design', minutes: 10, questions: ['Which components handle the read and write paths?', 'How does one request flow end to end?'] },
  { key: 'deepDives', title: 'Deep dives', minutes: 9, questions: ['Which one or two parts are hardest, and how do you solve them?', 'What would an interviewer probe first?'] },
  { key: 'bottlenecks', title: 'Bottlenecks', minutes: 4, questions: ['What breaks first at 10× load?', 'What fails, and what is the blast radius?'] },
  { key: 'tradeoffs', title: 'Trade-offs', minutes: 4, questions: ['What did you give up for each key choice?', 'What would you revisit with more time or different constraints?'] },
]
