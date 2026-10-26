// Company prep content: content/companies/<id>.json, compiled by scripts/build-content.mjs.
// Process stages are paraphrased from official careers pages; focus areas are editorial estimates
// from public candidate reports and are always labelled as such.

export const SOURCE_KINDS = ['official', 'reported'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]
export const FOCUS_LEVELS = ['low', 'medium', 'high'] as const
export type FocusLevel = (typeof FOCUS_LEVELS)[number]

export interface CompanySource { title: string; url: string; kind: SourceKind }
export interface CompanyStage { name: string; basis: SourceKind; detail: string; rounds: string[] }
export interface CompanyFocus { label: string; level: FocusLevel; patterns: string[] }
export interface CompanyValue { name: string; gist: string }
export interface CompanyPrompt { id: string; text: string }

export interface Company {
  id: string
  name: string
  summary: string
  asOf: string
  sources: CompanySource[]
  process: { note: string; stages: CompanyStage[] }
  focus: CompanyFocus[]
  practice: { minutes: number; count: number; problems: string[]; patterns: string[] }
  design: { note: string; cases: string[] }
  values: { title: string; url: string; summary: string; items: CompanyValue[]; prompts: CompanyPrompt[] }
}
