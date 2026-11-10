import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import Editor from '../components/Editor'
import { lessons } from '../curriculum'
import { clearDraft, readDraft, writeDraft, type DraftLanguage } from '../code-drafts'
import { isPathCore, loadProblems, patternProgress, problemIndex, problemPatterns } from '../problems'
import type { CodeLanguage, Problem, ProblemSummary } from '../problem-types'
import { formatArgs, formatValue } from '../runner/core'
import RunResults from '../components/RunResults'
import { runCode, type RunPhase, type RunReport } from '../runner/runner'
import TextBlocks from '../components/TextBlocks'
import OpenInPlayground from '../components/OpenInPlayground'
import { loadPatterns, patternsForProblem, type PatternPage, type PatternSummary } from '../patterns'
import { useSaveCheck } from '../relaunch-guard'
import { tsSolution, tsStarter } from '../ts-starter'

/** The pattern picture and its renderer load only once a hint has been revealed. */
const DiagramFigure = lazy(() => import('../components/Diagram'))

/** The scratchpad and its drawing tool load only when the panel is first opened. */
const Scratchpad = lazy(() => import('../components/Scratchpad').catch(() => ({ default: () => <p className="alert" role="alert">The scratchpad couldn’t load. Reconnect and try again.</p> })))

const LANGS: { id: DraftLanguage; label: string }[] = [{ id: 'js', label: 'JavaScript' }, { id: 'ts', label: 'TypeScript' }, { id: 'py', label: 'Python' }]
/** TypeScript runs the JavaScript tests and counts as a JavaScript solve; only the editor and type-checking differ. */
const base = (lang: DraftLanguage): CodeLanguage => lang === 'ts' ? 'js' : lang
const DIFFICULTY: Record<ProblemSummary['difficulty'], string> = { 'warm-up': 'Easy', core: 'Medium', stretch: 'Hard' }

function SolvedMarks({ solved }: { solved: Partial<Record<CodeLanguage, string>> | undefined }) {
  if (!solved) return null
  return <span className="solved-marks">{(['js', 'py'] as const).filter(lang => solved[lang]).map(lang => <span key={lang} className="pill solved"><Icon name="check" size={14} />{lang === 'js' ? 'JS' : 'Python'}</span>)}</span>
}

/** `lang` comes from a #code/<id>/<lang> link and wins over the draft's last language. */
export default function CodeScreen({ app, problemId, lang }: { app: AppModel; problemId?: string; lang?: DraftLanguage }) {
  const summary = problemIndex.find(problem => problem.id === problemId)
  // This screen is lazy, so it may mount after App's route-change focus has already run.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, summary?.id])
  return summary ? <ProblemPage key={summary.id} app={app} summary={summary} lang={lang} /> : <ProblemList app={app} />
}

const PATH_LABEL = { swe: 'SE core', senior: 'SSE core' } as const

function ProblemList({ app }: { app: AppModel }) {
  const { progress, heading } = app
  const path = progress.selectedPath
  const [pattern, setPattern] = useState('all')
  const [level, setLevel] = useState<'all' | 'se' | 'sse'>('all')
  const [difficulty, setDifficulty] = useState<'all' | ProblemSummary['difficulty']>('all')
  const [coreOnly, setCoreOnly] = useState(false)
  const shown = problemIndex.filter(problem => (pattern === 'all' || problem.pattern === pattern)
    && (level === 'all' || problem.level === level)
    && (difficulty === 'all' || problem.difficulty === difficulty)
    && (!coreOnly || isPathCore(problem, path)))
  const solvedCount = problemIndex.filter(problem => progress.solved?.[problem.id]).length
  const totals = new Map(patternProgress(progress).map(row => [row.pattern, row]))
  return <>
    <div className="page-heading"><div><div className="eyebrow">PRACTICE · CODE</div><h1 ref={heading} tabIndex={-1}>Code runner</h1><p>Original problems in JavaScript, TypeScript or Python. Tests run on your device.</p></div><span className="pill">{solvedCount} of {problemIndex.length} solved</span></div>
    <div className="code-filters">
      <div className="field">
        <label htmlFor="code-pattern">Pattern</label>
        <select id="code-pattern" value={pattern} onChange={event => setPattern(event.target.value)}>
          <option value="all">All patterns ({problemIndex.length})</option>
          {[...totals.values()].map(row => <option key={row.pattern} value={row.pattern}>{row.pattern} ({row.solved}/{row.total})</option>)}
        </select>
      </div>
      <fieldset className="field">
        <legend>Difficulty</legend>
        <div className="chip-group">
          {([['all', 'All'], ...Object.entries(DIFFICULTY)] as [typeof difficulty, string][]).map(([id, label]) => <label key={id} className="chip"><input type="radio" name="code-difficulty" checked={difficulty === id} onChange={() => setDifficulty(id)} />{label}</label>)}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>Level</legend>
        <div className="chip-group">
          {([['all', 'All'], ['se', 'SE'], ['sse', 'SSE stretch']] as const).map(([id, label]) => <label key={id} className="chip"><input type="radio" name="code-level" checked={level === id} onChange={() => setLevel(id)} />{label}</label>)}
          {path && <label className="chip"><input type="checkbox" checked={coreOnly} onChange={event => setCoreOnly(event.target.checked)} />{PATH_LABEL[path]} only</label>}
        </div>
      </fieldset>
    </div>
    {shown.length === 0 && <p className="card empty-note">No problems match these filters.</p>}
    {problemPatterns().map(name => {
      const items = shown.filter(problem => problem.pattern === name)
      if (!items.length) return null
      const total = totals.get(name)
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return <section key={name} className="code-group" aria-labelledby={`pattern-${slug}`}>
        <div className="code-group-head">
          <h2 className="section-title" id={`pattern-${slug}`}>{name}</h2>
          {total && <span className="pattern-count">{total.solved} of {total.total} solved</span>}
        </div>
        <ul className="card code-list">
          {items.map(problem => <li key={problem.id} className="code-row">
            <a href={`#code/${problem.id}`}>{problem.title}</a>
            <span className="code-row-meta">
              <span className={`pill diff-${problem.difficulty}`}>{DIFFICULTY[problem.difficulty]}</span>
              {problem.level === 'sse' && <span className="pill">SSE</span>}
              {isPathCore(problem, path) && <span className="pill core">{PATH_LABEL[path!]}</span>}
              <SolvedMarks solved={progress.solved?.[problem.id]} />
            </span>
          </li>)}
        </ul>
      </section>
    })}
  </>
}

function ProblemPage({ app, summary, lang }: { app: AppModel; summary: ProblemSummary; lang?: DraftLanguage }) {
  const [problem, setProblem] = useState<Problem>()
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    loadProblems().then(all => { if (live) setProblem(all.get(summary.id)) }, () => { if (live) setError('This problem could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [summary.id])
  const patterns = useMemo(() => patternsForProblem(summary), [summary])
  return <>
    <a className="back-link" href="#code"><Icon name="back" size={16} /> All problems</a>
    <div className="page-heading"><div><div className="eyebrow">{summary.pattern.toUpperCase()} · {DIFFICULTY[summary.difficulty].toUpperCase()}{summary.level === 'sse' ? ' · SSE' : ''}</div><h1 ref={app.heading} tabIndex={-1}>{summary.title}</h1></div><SolvedMarks solved={app.progress.solved?.[summary.id]} /></div>
    {patterns.map(page => <a key={page.id} className="text-button pattern-link" href={`#patterns/${page.id}`}><Icon name="target" size={16} />Learn the pattern: {page.title}</a>)}
    {error ? <div className="alert" role="alert">{error}</div> : problem ? <><Workspace key={lang} app={app} problem={problem} patterns={patterns} linkLang={lang} /><ScratchpadPanel app={app} summary={summary} /></> : <p role="status">Loading problem…</p>}
  </>
}

/**
 * The picture from the most specific linked pattern page (sub-pattern first, then listed, then category).
 * One picture keeps the hint focused; the other pages stay one tap away via "Learn the pattern".
 */
function PatternPicture({ patterns }: { patterns: PatternSummary[] }) {
  const [page, setPage] = useState<PatternPage | null>()
  useEffect(() => {
    let live = true
    loadPatterns().then(all => { if (live) setPage(patterns.map(item => all.get(item.id)).find(item => item?.picture) ?? null) }, () => { if (live) setPage(null) })
    return () => { live = false }
  }, [patterns])
  if (!page) return null
  return <section className="code-pattern-picture" aria-labelledby="pattern-picture-title">
    <h3 id="pattern-picture-title">From the <a href={`#patterns/${page.id}`}>{page.title}</a> pattern</h3>
    <Suspense fallback={<p role="status">Loading the picture…</p>}><DiagramFigure diagram={page.picture} number={1} /></Suspense>
  </section>
}

function Workspace({ app, problem, patterns, linkLang }: { app: AppModel; problem: Problem; patterns: PatternSummary[]; linkLang?: DraftLanguage }) {
  const [starter] = useState<Record<DraftLanguage, string>>(() => ({ ...problem.starter, ts: tsStarter(problem) }))
  const [lang, setLang] = useState<DraftLanguage>(() => linkLang ?? readDraft(problem.id).lang ?? 'js')
  const [code, setCode] = useState<Record<DraftLanguage, string>>(() => {
    const draft = readDraft(problem.id)
    return { js: draft.js ?? starter.js, py: draft.py ?? starter.py, ts: draft.ts ?? starter.ts }
  })
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [result, setResult] = useState<{ lang: DraftLanguage; report: RunReport; message?: string }>()
  const [hints, setHints] = useState(0)
  const [saveFailed, setSaveFailed] = useState(false)
  useSaveCheck(() => saveFailed ? 'Your code draft could not be saved.' : undefined)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const lesson = lessons.find(item => item.id === problem.lessonId)
  const fn = problem.function[base(lang)]
  const solution = lang === 'ts' ? tsSolution(problem) : problem.solution[lang]

  function chooseLang(next: DraftLanguage) {
    setLang(next)
    // A plan link chose the language once; drop it from the address so a reload keeps this choice.
    if (linkLang && window.location.hash !== `#code/${problem.id}`) window.history.replaceState(null, '', `#code/${problem.id}`)
    setSaveFailed(!writeDraft(problem.id, { lang: next }))
  }

  function edit(value: string) {
    setCode(current => ({ ...current, [lang]: value }))
    setSaveFailed(!writeDraft(problem.id, { lang, [lang]: value }))
  }

  function reset() {
    if (code[lang] !== starter[lang] && !window.confirm('Replace your code with the starter? Your current code will be lost.')) return
    setCode(current => ({ ...current, [lang]: starter[lang] }))
    setSaveFailed(!clearDraft(problem.id, lang))
  }

  async function run() {
    const runLang = lang
    setResult(undefined)
    const report = await runCode(runLang, { code: code[runLang], name: problem.function[base(runLang)], cases: [...problem.tests, ...problem.hiddenTests] }, setPhase)
    if (!live.current) return
    setPhase('idle')
    let message: string | undefined
    if (report.kind === 'done' && report.outcomes.every(outcome => outcome.pass)) {
      const gained = app.solveProblem(problem.id, base(runLang))
      message = `All ${report.outcomes.length} tests passed${gained ? ` · +${gained} XP` : ''}.`
    }
    setResult({ lang: runLang, report, message })
  }

  const busy = phase !== 'idle'
  return <div className="code-workspace">
    <section className="card code-brief" aria-labelledby="brief-title">
      <h2 id="brief-title" className="sr-only">Problem</h2>
      <TextBlocks text={problem.prompt} />
      <h3>Examples</h3>
      <ul className="example-list">
        {problem.tests.map((test, index) => <li key={index}><code>{fn}({formatArgs(test.args, base(lang))})</code> <span aria-hidden="true">→</span><span className="sr-only">returns</span> <code>{formatValue(test.expected, base(lang))}</code></li>)}
      </ul>
      {lesson && <p className="helper">Related lesson: <button className="text-button" onClick={() => app.start(lesson, app.progress.records[lesson.id] ? 'review' : 'learn')}>{lesson.title}</button></p>}
      <section className="code-hints" aria-labelledby="hints-title">
        <h3 id="hints-title">Hints</h3>
        {hints > 0 && <ol>{problem.hints.slice(0, hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
        {hints < problem.hints.length && <button onClick={() => setHints(hints + 1)}>Show hint {hints + 1} of {problem.hints.length}</button>}
        {hints > 0 && patterns.length > 0 && <PatternPicture patterns={patterns} />}
      </section>
      <details className="code-solution">
        <summary>Solution and complexity</summary>
        <p>{problem.solution.explanation}</p>
        {lang === 'ts' && <p className="helper">{solution ? 'The JavaScript solution with a typed signature.' : 'The JavaScript solution. Add types to use it as TypeScript.'}</p>}
        <pre><code>{solution ?? problem.solution.js}</code></pre>
        <dl className="complexity">
          <div><dt>Time</dt><dd>{problem.complexity.time}</dd></div>
          <div><dt>Space</dt><dd>{problem.complexity.space}</dd></div>
        </dl>
        <p className="helper">{problem.complexity.notes}</p>
        <h3>Follow-ups</h3>
        <ul>{problem.followUps.map(item => <li key={item}>{item}</li>)}</ul>
      </details>
    </section>

    <section className="card code-panel" aria-labelledby="editor-title">
      <div className="code-toolbar">
        <h2 id="editor-title" className="sr-only">Your solution</h2>
        <div className="segmented" role="radiogroup" aria-label="Language">
          {LANGS.map(item => <label key={item.id} className="chip"><input type="radio" name="code-lang" checked={lang === item.id} onChange={() => chooseLang(item.id)} disabled={busy} />{item.label}</label>)}
        </div>
        <button className="text-button" onClick={reset} disabled={busy}>Reset to starter</button>
      </div>
      <label htmlFor="code-editor" className="sr-only">{LANGS.find(item => item.id === lang)?.label} code</label>
      <Editor id="code-editor" lang={lang} value={code[lang]} onChange={edit} describedBy="editor-help" />
      <p id="editor-help" className="helper">Tab indents. Press Esc, then Tab, to leave the editor.{lang === 'py' ? ' Python’s first run downloads about 13 MB, then works offline.' : lang === 'ts' ? ' TypeScript’s first run downloads the compiler (about 3 MB compressed), then works offline. Type errors are listed but don’t fail tests.' : ''}{saveFailed ? ' Drafts can’t be saved in this browser.' : ''}</p>
      <div className="button-row">
        <button className="primary" onClick={() => { void run() }} disabled={busy}><Icon name="bolt" size={16} />{phase === 'loading-python' ? 'Loading Python…' : phase === 'loading-typescript' ? 'Loading TypeScript…' : phase === 'running' ? 'Running…' : 'Run tests'}</button>
        <OpenInPlayground lang={lang} name={problem.title} code={code[lang]} />
      </div>
      <div className="run-results" role="status" aria-live="polite">
        {result && <RunResults tests={problem.tests} fn={problem.function[base(result.lang)]} lang={base(result.lang)} typescript={result.lang === 'ts'} report={result.report} message={result.message} />}
      </div>
    </section>
  </div>
}

function ScratchpadPanel({ app, summary }: { app: AppModel; summary: ProblemSummary }) {
  const [opened, setOpened] = useState(false)
  return <details className="card scratchpad" onToggle={event => { if (event.currentTarget.open) setOpened(true) }}>
    <summary><Icon name="grid" size={18} /> Scratchpad <span className="muted">Trace arrays, trees and pointers. Saved for this problem.</span></summary>
    {opened && <Suspense fallback={<p role="status">Loading the scratchpad…</p>}><Scratchpad app={app} problemId={summary.id} title={summary.title} /></Suspense>}
  </details>
}