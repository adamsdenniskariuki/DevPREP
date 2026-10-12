import type { CaseSummary, DesignCase } from './case-types'
import index from './generated/case-index.json' with { type: 'json' }

export type { CaseSummary, DesignCase } from './case-types'

// Built from content/cases/*.json by scripts/build-content.mjs. The index is small and eager;
// full case studies (model answers, diagrams, rubrics) load lazily as one chunk.
export const caseIndex = index as CaseSummary[]
export const caseIds = new Set(caseIndex.map(item => item.id))

let cache: Promise<Map<string, DesignCase>> | undefined
export function loadCases(): Promise<Map<string, DesignCase>> {
  cache ??= import('./generated/cases.json').then(module => new Map((module.default as DesignCase[]).map(item => [item.id, item])))
  return cache
}
