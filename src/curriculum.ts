import type { Lesson, LessonLab, Track, TrackInfo } from './curriculum-types'
import curriculum from './generated/curriculum.json' with { type: 'json' }

export type { LabExercise, LabLanguage, Lesson, LessonLab, PlacementQuestion, PredictItem, Track, TrackInfo } from './curriculum-types'

// Built from content/<track>/*.json by scripts/build-content.mjs (runs before dev, build and tests).
export const tracks = curriculum.tracks as TrackInfo[]
export const lessons = curriculum.lessons as Lesson[]

/** The five interview tracks, in order. Language tracks come after them. */
export const CORE_TRACKS: readonly Track[] = ['dsa', 'system-design', 'ml', 'ai', 'behavioral']
export const interviewLessons = lessons.filter(lesson => CORE_TRACKS.includes(lesson.track))
export const isLanguageTrack = (track: Track) => tracks.find(item => item.id === track)?.kind === 'language'
export const interviewTracks = tracks.filter(item => item.kind !== 'language')
export const languageTracks = tracks.filter(item => item.kind === 'language')

let labs: Promise<Map<string, LessonLab>> | undefined
/** Runnable labs for language lessons (diagrams, exercises, quizzes) load lazily as one chunk. */
export function loadLabs(): Promise<Map<string, LessonLab>> {
  labs ??= import('./generated/labs.json').then(module => new Map(Object.entries(module.default as unknown as Record<string, LessonLab>)))
  return labs
}
