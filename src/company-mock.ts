import type { Company, MockRoundKind } from './company-types'
import type { DesignCase } from './case-types'
import type { Problem } from './problem-types'
import { caseQuestion, problemQuestion, SSE_STAR_RUBRIC, STAR_RUBRIC, seeded, shuffle } from './mocks'
import type { MockLevel, MockQuestion } from './mocks'

export interface CompanyMockRoundPlan { kind: MockRoundKind; minutes: number; question: MockQuestion }
export interface CompanyMock {
  company: string
  level: MockLevel
  seed: number
  rounds: CompanyMockRoundPlan[]
  /** Questions in round order, so mockScore works unchanged. */
  questions: MockQuestion[]
  minutes: number
}

export const ROUND_LABEL: Record<MockRoundKind, string> = { coding: 'Coding', design: 'System design', behavioural: 'Behavioural' }

type CompanyMockSource = Pick<Company, 'id' | 'name' | 'practice' | 'design' | 'values' | 'mock'>

/**
 * Builds a timed loop that follows the company's usual format. Coding rounds draw distinct problems from the
 * practice set, design rounds draw from the company's cases and behavioural rounds from its values prompts.
 * The same seed always gives the same loop, so a draft can be rebuilt after a reload.
 */
export function buildCompanyMock(company: CompanyMockSource, level: MockLevel, seed: number, data: { problems: Map<string, Problem>; cases: Map<string, DesignCase> }): CompanyMock {
  const random = seeded(seed)
  const problems = shuffle(company.practice.problems.map(id => data.problems.get(id)).filter((item): item is Problem => !!item), random)
  const cases = shuffle(company.design.cases.map(id => data.cases.get(id)).filter((item): item is DesignCase => !!item), random)
  const prompts = shuffle(company.values.prompts, random)
  const values = company.values.items.map(item => item.name).join(', ')
  const rounds: CompanyMockRoundPlan[] = []
  const used = { coding: 0, design: 0, behavioural: 0 }
  for (const round of company.mock.rounds) {
    const index = used[round.kind]++
    let question: MockQuestion | undefined
    if (round.kind === 'coding' && problems.length) question = problemQuestion(problems[index % problems.length])
    else if (round.kind === 'design' && cases.length) question = caseQuestion(cases[index % cases.length], level)
    else if (round.kind === 'behavioural' && prompts.length) {
      const prompt = prompts[index % prompts.length]
      question = {
        kind: 'behavioral', ref: prompt.id, title: `${company.name} values`, prompt: prompt.text,
        answer: `Use one story from your bank and tie it to ${company.values.title}: ${values}. Spend about 10% on the situation, 10% on the task, 60% on your actions and 20% on the result and what you learned.`,
        rubric: level === 'sse' ? [...STAR_RUBRIC, SSE_STAR_RUBRIC] : STAR_RUBRIC,
      }
    }
    if (question) rounds.push({ kind: round.kind, minutes: round.minutes, question })
  }
  return {
    company: company.id, level, seed, rounds,
    questions: rounds.map(round => round.question),
    minutes: rounds.reduce((sum, round) => sum + round.minutes, 0),
  }
}
