import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import type { Lesson, Track } from './curriculum'
import type { GameStats, WeakArea } from './gamification'
import type { LearningPath, PathId } from './learning-paths'
import type { CodeLanguage } from './problem-types'
import type { Activity, Mode, Profile, Progress } from './progress'

export type Route = 'home' | 'tracks' | 'practice' | 'progress' | 'settings' | 'study' | 'code'

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
  game: GameStats
  weak: WeakArea[]
  daysLeft: number | undefined
  heading: RefObject<HTMLHeadingElement | null>
  backupControls: ReactNode
  roadmapScope: 'path' | 'all'
  setRoadmapScope: Dispatch<SetStateAction<'path' | 'all'>>
  track: Track | 'all'
  setTrack: Dispatch<SetStateAction<Track | 'all'>>
  navigate: (next: Route) => void
  start: (lesson: Lesson, mode?: Mode) => void
  browseAll: (track?: Track | 'all') => void
  changePath: (id: PathId | undefined) => void
  changeProfile: (patch: Partial<Profile>) => void
  /** Records a passing run and returns the XP it earned (0 if already solved in that language). */
  solveProblem: (problemId: string, lang: CodeLanguage) => number
  tourOpen: boolean
  closeTour: () => void
  replayTour: () => void
}
