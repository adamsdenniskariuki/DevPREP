import type { Lesson, Track } from './curriculum-types'
import { dsaLessons } from './content/dsa'
import { systemDesignLessons } from './content/system-design'
import { mlLessons } from './content/ml'
import { behavioralLessons } from './content/behavioral'

export type { Lesson, Track } from './curriculum-types'

export const tracks: { id: Track; title: string; description: string }[] = [
  { id: 'dsa', title: 'Data structures & algorithms', description: 'Build from arrays and lookup tables to trees, graphs, and dynamic programming.' },
  { id: 'system-design', title: 'System design', description: 'Reason from requirements through data, distributed systems, and end-to-end designs.' },
  { id: 'ml', title: 'Machine learning', description: 'Prepare trustworthy data, understand models, and evaluate and operate practical ML systems.' },
  { id: 'behavioral', title: 'Behavioral interviews', description: 'Develop truthful stories about ownership, collaboration, decisions, and technical work.' },
]

export const lessons: Lesson[] = [...dsaLessons, ...systemDesignLessons, ...mlLessons, ...behavioralLessons]
