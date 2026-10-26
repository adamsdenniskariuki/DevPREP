import type { Company } from './company-types'
import ids from './generated/company-ids.json' with { type: 'json' }

export type { Company } from './company-types'

// Built from content/companies/*.json by scripts/build-content.mjs. Only the id list is eager
// (backups validate against it); the pages, with sources and prompts, load lazily as one chunk.
export const companyIds: readonly string[] = ids

let cache: Promise<Map<string, Company>> | undefined
export function loadCompanies(): Promise<Map<string, Company>> {
  cache ??= import('./generated/companies.json').then(module => new Map((module.default as Company[]).map(item => [item.id, item])))
  return cache
}
