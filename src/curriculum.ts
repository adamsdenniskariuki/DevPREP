import type { Lesson, Track } from './curriculum-types'
import curriculum from './generated/curriculum.json' with { type: 'json' }

export type { Lesson, Track } from './curriculum-types'

// Built from content/<track>/*.json by scripts/build-content.mjs (runs before dev, build and tests).
export const tracks = curriculum.tracks as { id: Track; title: string; description: string }[]
export const lessons = curriculum.lessons as Lesson[]