import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import type { Lesson, Track } from './curriculum'
import type { GameStats, WeakArea } from './gamification'
import type { LearningPath, PathId } from './learning-paths'
import type { CodeLanguage } from './problem-types'
import type { Activity, MockResult, Mode, Profile, Progress, Story } from './progress'
import type { Grade } from './flashcards'
import type { PatternLang } from './pattern-types'

export type Route = 'home' | 'tracks' | 'practice' | 'progress' | 'settings' | 'study' | 'code' | 'design' | 'board' | 'cards' | 'mock' | 'stories' | 'plan' | 'guide' | 'antipatterns' | 'sql' | 'patterns'

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
  /** Records a passing SQL problem and returns the XP gained (0 if already solved). */
  solveSqlProblem: (problemId: string) => number
  /** Saves a self-scored case study and returns the XP it added (0 if the best score did not improve the total). */
  scoreDesign: (caseId: string, percent: number) => number
  /** Records a Field Guide quiz score (best kept) and returns the XP gained. */
  readGuide: (guideId: string, percent: number) => number
  /** Records a passing pattern exercise run and returns the XP gained (0 if already passed in that language). */
  passPatternExercise: (pageId: string, lang: PatternLang) => number
  /** Records a pattern quick-check score (best kept) and returns the XP gained. */
  scorePatternQuiz: (pageId: string, percent: number) => number
  /** Records a finished pattern picker round and returns the XP gained. */
  finishPicker: (score: number) => number
  /** Saves a language placement check; returns the lessons it marked known. */
  placeTrack: (track: Track, answers: (number | undefined)[]) => { percent: number; known: string[] }
  /** Grades a flashcard and returns the XP it earned. */
  gradeCard: (cardId: string, grade: Grade) => number
  /** Saves a finished mock interview and returns the XP it earned. */
  finishMock: (result: Omit<MockResult, 'at'>) => number
  /** Adds or updates a story. Returns an error message, or an empty string on success. */
  saveStory: (story: Omit<Story, 'updatedAt'>) => string
  deleteStory: (id: string) => void
  tourOpen: boolean
  closeTour: () => void
  replayTour: () => void
}
