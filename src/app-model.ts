import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import type { Lesson, Track } from './curriculum'
import type { LearningPath } from './learning-paths'
import type { Activity, Mode, Progress } from './progress'

export type Route = 'today' | 'roadmap' | 'review' | 'progress' | 'study'

/** Derived state and actions shared by the routed screens. */
export interface AppModel {
  progress: Progress
  due: Lesson[]
  completed: number
  selectedPath: LearningPath | undefined
  selectedStatus: { completed: number; total: number; percent: number } | undefined
  nextLesson: Lesson | undefined
  todayActivity: Activity[]
  learnedToday: boolean
  reviewedToday: boolean
  activeLesson: Lesson | undefined
  percent: number
  outsidePath: boolean | undefined
  clock: Date
  today: string
  heading: RefObject<HTMLHeadingElement | null>
  backupControls: ReactNode
  roadmapScope: 'path' | 'all'
  setRoadmapScope: Dispatch<SetStateAction<'path' | 'all'>>
  track: Track | 'all'
  setTrack: Dispatch<SetStateAction<Track | 'all'>>
  navigate: (next: Route) => void
  start: (lesson: Lesson, mode?: Mode) => void
  browseAll: (track?: Track | 'all') => void
}