import type { Phase, Rating } from './progress'

export const phaseLabels: Record<Phase, string> = { lesson: 'Learn', practice: 'Practice', assess: 'Reflect' }
export const ratingLabels: Record<Rating, string> = { again: 'Needs practice', okay: 'Getting there', confident: 'Confident' }
