import { patternPageDone } from './gamification'
import { TOPIC_LABELS } from './guide-types'
import type { GuideTopic } from './guide-types'
import type { DeepSections, NavIndex, NavNode, NavProgress } from './nav-model'

/* Loaded with the nav index so the deep levels of the tree stay out of the main chunk. */

const tally = (items: readonly NavNode[]) => ({ done: items.filter(item => item.done).length, total: items.length })
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Groups leaves under one parent node per key, keeping the first-seen key order. */
function grouped(prefix: string, items: readonly NavNode[], keys: readonly string[], label: (key: string) => string): NavNode[] {
  const order = [...new Set(keys)]
  return order.map(key => {
    const children = items.filter((_, index) => keys[index] === key)
    return { id: `${prefix}:${slug(key)}`, label: label(key), count: tally(children), children }
  })
}

const leaf = (route: string, done: (id: string) => boolean) => ([id, title]: readonly [string, string, ...unknown[]]): NavNode =>
  ({ id: `${route}/${id}`, label: title, href: `#${route}/${id}`, done: done(id) })

/** The children and counts of every section whose items come from the nav index, keyed by section id. */
export function deepSections(progress: NavProgress, nav: NavIndex): DeepSections {
  const tracks = nav.tracks.map(([id, title, lessonIds]): NavNode => {
    const done = lessonIds.filter(lesson => progress.records[lesson]).length
    return { id: `tracks/${id}`, label: title, href: `#tracks/${id}`, count: { done, total: lessonIds.length }, done: lessonIds.length > 0 && done === lessonIds.length }
  })
  const lessons = nav.tracks.flatMap(([, , lessonIds]) => lessonIds)

  const patternDone = (id: string) => patternPageDone(progress, id)
  const page = leaf('patterns', patternDone)
  const patterns = [
    ...nav.patterns.filter(([, , parent]) => !parent).map(top => {
      const children = nav.patterns.filter(([, , parent]) => parent === top[0]).map(page)
      return children.length ? { ...page(top), children } : page(top)
    }),
    { id: 'patterns/pick', label: 'Pattern picker', href: '#patterns/pick' },
    { id: 'patterns/cheatsheet', label: 'Cheat sheet', href: '#patterns/cheatsheet' },
  ]

  const guideLeaves = nav.guides.map(leaf('guide', id => !!progress.guides?.[id]))
  const guides = [...grouped('guide', guideLeaves, nav.guides.map(([, , topic]) => topic), topic => TOPIC_LABELS[topic as GuideTopic] ?? topic),
    { id: 'antipatterns', label: 'Anti-pattern gallery', href: '#antipatterns' }]

  const problems = nav.problems.map(leaf('code', id => !!progress.solved?.[id]))
  const sql = nav.sql.map(leaf('sql', id => !!progress.sqlSolved?.[id]))
  const cases = nav.cases.map(leaf('design', id => !!progress.designs?.[id]))
  const companies = nav.companies.map(leaf('company', id => !!progress.companies?.[id]?.length))
  const mocks = nav.companies.map(([id, name]): NavNode => ({ id: `mock/${id}`, label: `${name} mock loop`, href: `#mock/${id}`, done: !!progress.companyMocks?.[id]?.length }))

  return {
    tracks: { children: tracks, count: { done: lessons.filter(lesson => progress.records[lesson]).length, total: lessons.length } },
    patterns: { children: patterns, count: { done: nav.patterns.filter(([id]) => patternDone(id)).length, total: nav.patterns.length } },
    guide: { children: guides, count: tally(guideLeaves) },
    code: { children: grouped('code', problems, nav.problems.map(([, , pattern]) => pattern), key => key), count: tally(problems) },
    sql: { children: grouped('sql', sql, nav.sql.map(([, , topic]) => topic), key => key), count: tally(sql) },
    cases: { children: cases, count: tally(cases) },
    company: { children: companies, count: tally(companies) },
    mock: { children: mocks },
  }
}
