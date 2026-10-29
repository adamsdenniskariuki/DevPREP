import { useEffect, useMemo, useState } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import TextBlocks from '../components/TextBlocks'
import SqlLabRunner, { ResultTable } from '../components/SqlLab'
import OpenInPlayground from '../components/OpenInPlayground'
import { lessons } from '../curriculum'
import type { SqlExercise } from '../curriculum-types'
import { clearDraft, readDraft, writeDraft } from '../code-drafts'
import { isPathCore } from '../problems'
import { loadSqlProblems, sqlProblemIndex, sqlTopicProgress, sqlTopics } from '../sql-problems'
import type { SqlProblem, SqlProblemSummary } from '../sql-problems'
import { useSaveCheck } from '../relaunch-guard'

const DIFFICULTY: Record<SqlProblemSummary['difficulty'], string> = { 'warm-up': 'Easy', core: 'Medium', stretch: 'Hard' }
const PATH_LABEL = { swe: 'SE core', senior: 'SSE core' } as const
const draftKey = (id: string) => `sql:${id}`

export default function SqlProblemsScreen({ app, problemId }: { app: AppModel; problemId?: string }) {
  const summary = sqlProblemIndex.find(problem => problem.id === problemId)
  // This screen is lazy, so it may mount after App's route-change focus has already run.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, summary?.id])
  return summary ? <ProblemPage key={summary.id} app={app} summary={summary} /> : <ProblemList app={app} />
}

function SolvedMark({ at }: { at?: string }) {
  return at ? <span className="pill solved"><Icon name="check" size={14} />Solved</span> : null
}

function ProblemList({ app }: { app: AppModel }) {
  const { progress, heading } = app
  const path = progress.selectedPath
  const [topic, setTopic] = useState('all')
  const [level, setLevel] = useState<'all' | 'se' | 'sse'>('all')
  const [difficulty, setDifficulty] = useState<'all' | SqlProblemSummary['difficulty']>('all')
  const [coreOnly, setCoreOnly] = useState(false)
  const shown = sqlProblemIndex.filter(problem => (topic === 'all' || problem.topic === topic)
    && (level === 'all' || problem.level === level)
    && (difficulty === 'all' || problem.difficulty === difficulty)
    && (!coreOnly || isPathCore(problem, path)))
  const solvedCount = sqlProblemIndex.filter(problem => progress.sqlSolved?.[problem.id]).length
  const totals = new Map(sqlTopicProgress(progress).map(row => [row.topic as string, row]))
  return <>
    <div className="page-heading"><div><div className="eyebrow">PRACTICE · SQL</div><h1 ref={heading} tabIndex={-1}>SQL problems</h1><p>Interview SQL on real Postgres, running in your browser.</p></div><span className="pill">{solvedCount} of {sqlProblemIndex.length} solved</span></div>
    <div className="code-filters">
      <div className="field">
        <label htmlFor="sql-topic">Topic</label>
        <select id="sql-topic" value={topic} onChange={event => setTopic(event.target.value)}>
          <option value="all">All topics ({sqlProblemIndex.length})</option>
          {[...totals.values()].map(row => <option key={row.topic} value={row.topic}>{row.topic} ({row.solved}/{row.total})</option>)}
        </select>
      </div>
      <fieldset className="field">
        <legend>Difficulty</legend>
        <div className="chip-group">
          {([['all', 'All'], ...Object.entries(DIFFICULTY)] as [typeof difficulty, string][]).map(([id, label]) => <label key={id} className="chip"><input type="radio" name="sql-difficulty" checked={difficulty === id} onChange={() => setDifficulty(id)} />{label}</label>)}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>Level</legend>
        <div className="chip-group">
          {([['all', 'All'], ['se', 'SE'], ['sse', 'SSE stretch']] as const).map(([id, label]) => <label key={id} className="chip"><input type="radio" name="sql-level" checked={level === id} onChange={() => setLevel(id)} />{label}</label>)}
          {path && <label className="chip"><input type="checkbox" checked={coreOnly} onChange={event => setCoreOnly(event.target.checked)} />{PATH_LABEL[path]} only</label>}
        </div>
      </fieldset>
    </div>
    {shown.length === 0 && <p className="card empty-note">No problems match these filters.</p>}
    {sqlTopics().map(name => {
      const items = shown.filter(problem => problem.topic === name)
      if (!items.length) return null
      const total = totals.get(name)
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return <section key={name} className="code-group" aria-labelledby={`sql-topic-${slug}`}>
        <div className="code-group-head">
          <h2 className="section-title" id={`sql-topic-${slug}`}>{name}</h2>
          {total && <span className="pattern-count">{total.solved} of {total.total} solved</span>}
        </div>
        <ul className="card code-list">
          {items.map(problem => <li key={problem.id} className="code-row">
            <a href={`#sql/${problem.id}`}>{problem.title}</a>
            <span className="code-row-meta">
              <span className={`pill diff-${problem.difficulty}`}>{DIFFICULTY[problem.difficulty]}</span>
              {problem.level === 'sse' && <span className="pill">SSE</span>}
              {isPathCore(problem, path) && <span className="pill core">{PATH_LABEL[path!]}</span>}
              <SolvedMark at={progress.sqlSolved?.[problem.id]} />
            </span>
          </li>)}
        </ul>
      </section>
    })}
  </>
}

function ProblemPage({ app, summary }: { app: AppModel; summary: SqlProblemSummary }) {
  const [problem, setProblem] = useState<SqlProblem>()
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    loadSqlProblems().then(all => { if (live) setProblem(all.get(summary.id)) }, () => { if (live) setError('This problem could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [summary.id])
  return <>
    <a className="back-link" href="#sql"><Icon name="back" size={16} /> All SQL problems</a>
    <div className="page-heading"><div><div className="eyebrow">SQL · {summary.topic.toUpperCase()} · {DIFFICULTY[summary.difficulty].toUpperCase()}{summary.level === 'sse' ? ' · SSE' : ''}</div><h1 ref={app.heading} tabIndex={-1}>{summary.title}</h1></div><SolvedMark at={app.progress.sqlSolved?.[summary.id]} /></div>
    {error ? <div className="alert" role="alert">{error}</div> : problem ? <Workspace app={app} problem={problem} /> : <p role="status">Loading problem…</p>}
  </>
}

function Workspace({ app, problem }: { app: AppModel; problem: SqlProblem }) {
  const exercise = useMemo<SqlExercise>(() => ({ ...problem.exercise, id: 'core' }), [problem])
  const [code, setCode] = useState(() => readDraft(draftKey(problem.id)).sql ?? problem.exercise.starter)
  const [hints, setHints] = useState(0)
  const [saveFailed, setSaveFailed] = useState(false)
  useSaveCheck(() => saveFailed ? 'Your SQL draft could not be saved.' : undefined)
  const lesson = lessons.find(item => item.id === problem.lessonId)
  const example = problem.exercise.tests[0]

  function edit(value: string) {
    setCode(value)
    setSaveFailed(value === problem.exercise.starter ? !clearDraft(draftKey(problem.id), 'sql') : !writeDraft(draftKey(problem.id), { sql: value }))
  }

  return <div className="code-workspace">
    <section className="card code-brief" aria-labelledby="brief-title">
      <h2 id="brief-title" className="sr-only">Problem</h2>
      <TextBlocks text={problem.prompt} />
      <h3>Example: {example.name}</h3>
      <ResultTable caption={`Expected result${problem.exercise.ordered ? ' (in this order)' : ''}`} columns={example.expected.columns} rows={example.expected.rows} />
      {lesson && <p className="helper">Related lesson: <button className="text-button" onClick={() => app.start(lesson, app.progress.records[lesson.id] ? 'review' : 'learn')}>{lesson.title}</button></p>}
      <section className="code-hints" aria-labelledby="hints-title">
        <h3 id="hints-title">Hints</h3>
        {hints > 0 && <ol>{problem.hints.slice(0, hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
        {hints < problem.hints.length && <button onClick={() => setHints(hints + 1)}>Show hint {hints + 1} of {problem.hints.length}</button>}
      </section>
      <details className="code-solution">
        <summary>Solution and notes</summary>
        <p>{problem.explanation}</p>
        <pre><code>{problem.exercise.solution}</code></pre>
        <p className="helper">{problem.notes}</p>
        <h3>Follow-ups</h3>
        <ul>{problem.followUps.map(item => <li key={item}>{item}</li>)}</ul>
      </details>
    </section>
    <section className="card code-panel" aria-labelledby="editor-title">
      <h2 id="editor-title" className="sr-only">Your query</h2>
      <SqlLabRunner exercise={exercise} value={code} onChange={edit} onPass={() => app.solveSqlProblem(problem.id)} label="Your query" />
      {saveFailed && <p className="helper">Drafts can’t be saved in this browser.</p>}
      <div className="button-row"><OpenInPlayground lang="sql" name={problem.title} code={playgroundSql(exercise.schema, code)} /></div>
    </section>
  </div>
}

/** The query for the Playground, with the problem's tables as a commented-out script to create them there. */
function playgroundSql(schema: string, query: string): string {
  const tables = schema.trim().split('\n').map(line => `-- ${line}`).join('\n')
  return `-- Tables used by this problem. Uncomment to create them in the Playground database:\n${tables}\n\n${query}`
}
