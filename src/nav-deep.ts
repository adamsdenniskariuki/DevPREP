import { patternPageDone } from './gamification'
import { TOPIC_LABELS } from './guide-types'
import type { GuideTopic } from './guide-types'
import type { DeepSections, NavIndex, NavNode, NavProgress } from './nav-model'
import { readPlans, type PlansState } from './study-plans'
import { readCodebaseProgress, type CodebaseProgress } from './codebase'
import { readReactProgress, type ReactProgress } from './react-module'
import { readNodeProgress, type NodeProgress } from './node-module'
import { readReactNativeProgress, type ReactNativeProgress } from './react-native-module'
import { readSkillTests, type SkillTestsState } from './skill-tests'

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
export function deepSections(progress: NavProgress, nav: NavIndex, planState: PlansState = readPlans(), codebaseState: CodebaseProgress = readCodebaseProgress(), reactState: ReactProgress = readReactProgress(), skillState: SkillTestsState = readSkillTests(), nodeState: NodeProgress = readNodeProgress(), reactNativeState: ReactNativeProgress = readReactNativeProgress()): DeepSections {
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

  // Study plan progress lives in its own storage key. Count the items of the track each learner follows.
  const plans = (nav.plans ?? []).map(([id, title, planTracks, weeks]): NavNode => {
    const entry = planState[id]
    const track = planTracks.some(([trackId]) => trackId === entry?.track) ? entry!.track : planTracks[0]?.[0] ?? ''
    const items = weeks.filter(([, , weekTrack]) => !weekTrack || weekTrack === track).flatMap(([, , , ids]) => ids)
    const done = items.filter(item => entry?.done[item]).length
    return { id: `plans/${id}`, label: title, href: `#plans/${id}`, count: { done, total: items.length }, done: items.length > 0 && done === items.length }
  })

  // Codebase practice progress also lives in its own storage key.
  const codebaseTasks = (nav.codebase ?? []).flatMap(([repo, repoTitle, , tasks]) => tasks.map(([task, title]): NavNode =>
    ({ id: `codebase/${repo}/${task}`, label: `${repoTitle}: ${title}`, href: `#codebase/${repo}/${task}`, done: !!codebaseState[`${repo}/${task}`]?.completed })))

  // The React module and skill tests keep their progress in their own keys too.
  const reactLessons = (nav.react ?? []).filter(([, , kind]) => kind === 'lesson').map(leaf('react', () => false)).map(({ done: _, ...node }) => node)
  const reactExercises = (nav.react ?? []).filter(([, , kind]) => kind === 'exercise').map(leaf('react', id => !!reactState[id]?.completed))
  const react: NavNode[] = [
    { id: 'react:lessons', label: 'Lessons', children: reactLessons },
    { id: 'react:exercises', label: 'Exercises', count: tally(reactExercises), children: reactExercises },
  ]
  const nodeLessons = (nav.node ?? []).filter(([, , kind]) => kind === 'lesson').map(leaf('node', () => false)).map(({ done: _, ...node }) => node)
  const nodeExercises = (nav.node ?? []).filter(([, , kind]) => kind === 'exercise').map(leaf('node', id => !!nodeState[id]?.completed))
  const node: NavNode[] = [
    { id: 'node:lessons', label: 'Lessons', children: nodeLessons },
    { id: 'node:exercises', label: 'Exercises', count: tally(nodeExercises), children: nodeExercises },
  ]
  const reactNativeLessons = (nav.reactNative ?? []).filter(([, , kind]) => kind === 'lesson').map(leaf('react-native', () => false)).map(({ done: _, ...node }) => node)
  const reactNativeExercises = (nav.reactNative ?? []).filter(([, , kind]) => kind === 'exercise').map(leaf('react-native', id => !!reactNativeState[id]?.completed))
  const reactNative: NavNode[] = [
    { id: 'react-native:lessons', label: 'Lessons', children: reactNativeLessons },
    { id: 'react-native:exercises', label: 'Exercises', count: tally(reactNativeExercises), children: reactNativeExercises },
  ]
  const skillTests = (nav.skillTests ?? []).map(leaf('skilltest', id => !!skillState[id]?.length))

  return {
    tracks: { children: tracks, count: { done: lessons.filter(lesson => progress.records[lesson]).length, total: lessons.length } },
    patterns: { children: patterns, count: { done: nav.patterns.filter(([id]) => patternDone(id)).length, total: nav.patterns.length } },
    guide: { children: guides, count: tally(guideLeaves) },
    code: { children: grouped('code', problems, nav.problems.map(([, , pattern]) => pattern), key => key), count: tally(problems) },
    sql: { children: grouped('sql', sql, nav.sql.map(([, , topic]) => topic), key => key), count: tally(sql) },
    cases: { children: cases, count: tally(cases) },
    company: { children: companies, count: tally(companies) },
    mock: { children: mocks },
    codebase: { children: codebaseTasks, count: tally(codebaseTasks) },
    react: { children: react, count: tally(reactExercises) },
    node: { children: node, count: tally(nodeExercises) },
    'react-native': { children: reactNative, count: tally(reactNativeExercises) },
    skilltest: { children: skillTests, count: tally(skillTests) },
    plans: { children: plans, count: plans.reduce((sum, plan) => ({ done: sum.done + plan.count!.done, total: sum.total + plan.count!.total }), { done: 0, total: 0 }) },
  }
}
