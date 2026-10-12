export const COMPETENCIES = [
  { id: 'ownership', title: 'Ownership', prompt: 'Tell me about a time you owned a problem end to end.' },
  { id: 'delivery', title: 'Delivery', prompt: 'Describe a project you shipped under a tight deadline.' },
  { id: 'conflict', title: 'Conflict', prompt: 'Tell me about a disagreement with a teammate and how it was resolved.' },
  { id: 'failure', title: 'Failure', prompt: 'Describe a mistake you made and what you changed afterwards.' },
  { id: 'ambiguity', title: 'Ambiguity', prompt: 'Tell me about work that started with unclear requirements.' },
  { id: 'influence', title: 'Influence', prompt: 'Describe how you changed a decision without having authority.' },
  { id: 'mentoring', title: 'Mentoring', prompt: 'Tell me about someone you helped grow.' },
  { id: 'prioritization', title: 'Prioritization', prompt: 'Describe a time you had to say no or cut scope.' },
  { id: 'customer', title: 'Customer focus', prompt: 'Tell me about a time you changed course because of user feedback.' },
  { id: 'technical', title: 'Technical depth', prompt: 'Walk me through the hardest technical problem you solved.' },
] as const

export type Competency = typeof COMPETENCIES[number]['id']
export const COMPETENCY_IDS: readonly Competency[] = COMPETENCIES.map(item => item.id)

/** Competencies interviewers weigh more heavily at senior level. */
export const SSE_SIGNALS: readonly Competency[] = ['influence', 'mentoring', 'ambiguity', 'conflict']

export function newStoryId(random = Math.random): string {
  return 's' + Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random() * 36)]).join('')
}
