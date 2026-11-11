import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import Editor from '../components/Editor'
import RunProgress, { BUSY_LABEL } from '../components/RunProgress'
import { useBusy, useSaveCheck } from '../relaunch-guard'
import { runProject, type ProjectReport } from '../runner/runner'
import type { RunPhase } from '../runner/runner'
import { formatProjectDiagnostic, PROJECT_TIMEOUT_MS } from '../runner/project'
import {
  changedFiles, completedCount, CODEBASE_TASK_IDS, isHiddenOutcome, isTestFile, LANGUAGE_LABELS, loadCodebase, MAX_FILE_LENGTH,
  readCodebaseProgress, readTaskDraft, recordAttempt, recordReveal, recordScores, sortPaths, starterFiles, submitRequest, taskKey,
  timerElapsed, visibleRequest, writeCodebaseProgress, writeTaskDraft,
} from '../codebase'
import type { CodebaseContent, CodebaseGuide, CodebaseProgress, CodebaseRepo, CodebaseTask, Scores, TaskDraft, TimerState } from '../codebase'
import { loadPlans, MAX_NOTES, MAX_SCORES, newEntryId, readPlans, withPlan, writePlans, type Scorecard, type StudyPlan } from '../study-plans'
import '../codebase.css'

const KIND_LABEL = { bug: 'Bug fix', feature: 'Small feature' } as const
const DEFAULT_PLANS = ['forward-deployed-engineer-8wk', 'applied-ai-ml-10wk']

export default function CodebaseScreen({ app, taskKey: key }: { app: AppModel; taskKey?: string }) {
  const [content, setContent] = useState<CodebaseContent>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    loadCodebase().then(value => { if (live) setContent(value) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  // This screen is lazy, so it may mount after App's route-change focus has already run.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, key, !!content])

  if (failed) return <><Heading app={app} title="Codebase interviews" /><p role="alert">The practice codebases could not load. Check your connection and try again.</p></>
  if (!content) return <><Heading app={app} title="Codebase interviews" /><p role="status">Loading the practice codebases…</p></>
  if (!key) return <GuidePage app={app} content={content} />
  const [repoId, taskId] = key.split('/')
  const repo = content.repos.find(item => item.id === repoId)
  const task = repo?.tasks.find(item => item.id === taskId)
  if (!repo || !task) return <>
    <a className="back-link" href="#codebase"><Icon name="back" size={16} /> Codebase interviews</a>
    <Heading app={app} title="Task not found" />
    <p>That codebase task does not exist. <a href="#codebase">Choose a task from the list</a>.</p>
  </>
  return <TaskPage key={key} app={app} guide={content.guide} repo={repo} task={task} />
}

function Heading({ app, title, eyebrow = 'PRACTICE · CODEBASE', children }: { app: AppModel; title: string; eyebrow?: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 ref={app.heading} tabIndex={-1}>{title}</h1>{children}</div></div>
}

const average = (scores: readonly number[]) => scores.reduce((sum, value) => sum + value, 0) / scores.length

/* ---------- Guide and task list ---------- */

function GuidePage({ app, content }: { app: AppModel; content: CodebaseContent }) {
  const { guide, repos } = content
  const progress = useMemo(readCodebaseProgress, [])
  return <div className="codebase">
    <div className="page-heading">
      <div><div className="eyebrow">PRACTICE · CODEBASE</div><h1 ref={app.heading} tabIndex={-1}>{guide.title}</h1><p>{guide.summary}</p></div>
      <span className="pill">{completedCount(progress)} of {CODEBASE_TASK_IDS.length} completed</span>
    </div>
    <section className="card codebase-section" aria-labelledby="codebase-steps">
      <h2 id="codebase-steps">The seven steps</h2>
      <ol className="codebase-steps">
        {guide.steps.map(step => <li key={step.id}>
          <details>
            <summary><span>{step.title}</span> <span className="muted">{step.minutes}</span></summary>
            {step.body.map((text, index) => <p key={index}>{text}</p>)}
            {step.checklist.length > 0 && <ul className="codebase-checklist">{step.checklist.map((item, index) => <li key={index}>{item}</li>)}</ul>}
          </details>
        </li>)}
      </ol>
      <h3>Throughout</h3>
      <ul>{guide.throughout.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </section>
    <Rubric guide={guide} />
    <section aria-labelledby="codebase-repos">
      <h2 id="codebase-repos">Practice codebases</h2>
      <p className="muted">Each one is a small, runnable project. Read it, run its tests, then fix the bug or add the feature. Everything runs in your browser.</p>
      <div className="codebase-repos">
        {repos.map(repo => <RepoCard key={repo.id} repo={repo} progress={progress} />)}
      </div>
    </section>
  </div>
}

function Rubric({ guide }: { guide: CodebaseGuide }) {
  return <section className="card codebase-section" aria-labelledby="codebase-rubric">
    <h2 id="codebase-rubric">How you are scored</h2>
    <p className="muted">Interviewers score four areas from 1 (not yet) to 4 (strong). Use the same rubric for your self-review after each task.</p>
    <div className="codebase-rubric">
      {guide.rubric.map(area => <div key={area.id} className="codebase-rubric-area">
        <h3>{area.title}</h3>
        <ol>{area.levels.map((level, index) => <li key={index}><strong>{index + 1}.</strong> {level}</li>)}</ol>
      </div>)}
    </div>
  </section>
}

function RepoCard({ repo, progress }: { repo: CodebaseRepo; progress: CodebaseProgress }) {
  return <section className="card codebase-repo" aria-labelledby={`repo-${repo.id}`}>
    <div className="codebase-repo-head">
      <h3 id={`repo-${repo.id}`}>{repo.title}</h3>
      <span className="pill">{LANGUAGE_LABELS[repo.lang]}</span>
    </div>
    <p>{repo.summary}</p>
    <ul className="codebase-task-list">
      {repo.tasks.map(task => {
        const entry = progress[taskKey(repo.id, task.id)]
        return <li key={task.id}>
          <a href={`#codebase/${repo.id}/${task.id}`}>{task.title}</a>
          <span className="code-row-meta">
            <span className="pill">{KIND_LABEL[task.kind]}</span>
            <span className="pill">{task.minutes} min</span>
            {entry?.completed && <span className="pill solved"><Icon name="check" size={14} />Completed</span>}
            {entry?.best && <span className="pill">Self-review {average(entry.best).toFixed(1)}</span>}
            {!entry?.completed && entry?.attempts ? <span className="pill">{entry.attempts === 1 ? '1 submit' : `${entry.attempts} submits`}</span> : null}
          </span>
        </li>
      })}
    </ul>
  </section>
}

/* ---------- One task ---------- */

interface TreeNode { path: string; name: string; children?: TreeNode[] }

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const path of paths) {
    const parts = path.split('/')
    let level = root
    parts.forEach((name, index) => {
      const at = parts.slice(0, index + 1).join('/')
      const leaf = index === parts.length - 1
      let node = level.find(item => item.path === at)
      if (!node) {
        node = leaf ? { path: at, name } : { path: at, name, children: [] }
        level.push(node)
      }
      if (!leaf) level = node.children!
    })
  }
  const order = (nodes: TreeNode[]): TreeNode[] => [...nodes.filter(node => node.children), ...nodes.filter(node => !node.children)].map(node => node.children ? { ...node, children: order(node.children) } : node)
  return order(root)
}

function formatClock(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

type Result = { mode: 'run' | 'submit'; report: ProjectReport }

function TaskPage({ app, guide, repo, task }: { app: AppModel; guide: CodebaseGuide; repo: CodebaseRepo; task: CodebaseTask }) {
  const key = taskKey(repo.id, task.id)
  const starter = useMemo(() => starterFiles(repo, task), [repo, task])
  const paths = useMemo(() => sortPaths(Object.keys(starter)), [starter])
  const initial = useMemo(() => readTaskDraft(key), [key])
  const [files, setFiles] = useState<Record<string, string>>(() => ({ ...starter, ...Object.fromEntries(Object.entries(initial.files).filter(([path]) => path in starter)) }))
  const [active, setActive] = useState(() => paths.find(path => !path.endsWith('.md') && !isTestFile(repo.lang, path)) ?? paths[0])
  const [timer, setTimer] = useState<TimerState | undefined>(initial.timer)
  const [submitted, setSubmitted] = useState(!!initial.submitted)
  const [progress, setProgress] = useState(() => readCodebaseProgress()[key])
  const [now, setNow] = useState(() => Date.now())
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [done, setDone] = useState(0)
  const [result, setResult] = useState<Result>()
  const [saveFailed, setSaveFailed] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const busy = phase !== 'idle'
  const running = !!timer?.since
  const elapsed = timerElapsed(timer, now)
  const limit = task.minutes * 60_000
  const timeUp = elapsed >= limit

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    const draft: TaskDraft = { files: changedFiles(starter, files), ...timer ? { timer } : {}, ...submitted ? { submitted: true } : {} }
    setSaveFailed(!writeTaskDraft(key, draft))
  }, [key, starter, files, timer, submitted])

  useSaveCheck(() => saveFailed ? 'Your codebase draft could not be saved.' : undefined)
  useBusy(busy ? 'Codebase tests' : running && 'A timed codebase task')

  const changed = useMemo(() => new Set(Object.keys(changedFiles(starter, files))), [starter, files])

  const toggleTimer = () => {
    const at = Date.now()
    setNow(at)
    setTimer(current => current?.since ? { elapsed: timerElapsed(current, at) } : { elapsed: current?.elapsed ?? 0, since: at })
  }
  const resetTimer = () => { setNow(Date.now()); setTimer(undefined) }

  const saveProgress = (next: NonNullable<typeof progress>) => {
    const all = readCodebaseProgress()
    all[key] = next
    if (!writeCodebaseProgress(all)) setSaveFailed(true)
    setProgress(next)
  }

  const run = async (mode: Result['mode']) => {
    if (busy) return
    setDone(0)
    setResult(undefined)
    const request = mode === 'run' ? visibleRequest(repo.lang, files) : submitRequest(repo.lang, files, task)
    try {
      const report = await runProject(repo.lang, request, setPhase, setDone)
      setResult({ mode, report })
      if (mode === 'submit') {
        const passed = report.kind === 'done' && report.outcomes.length > 0 && report.outcomes.every(outcome => outcome.pass)
        saveProgress(recordAttempt(readCodebaseProgress()[key], passed, app.today))
        setSubmitted(true)
      }
    } finally {
      setPhase('idle')
    }
  }

  const resetFile = () => setFiles(current => ({ ...current, [active]: starter[active] }))
  const resetAll = () => { setFiles({ ...starter }); setConfirmReset(false); setResult(undefined) }
  const reveal = () => saveProgress(recordReveal(readCodebaseProgress()[key]))
  const walkthroughOpen = submitted || timeUp || !!progress?.revealed

  return <div className="codebase">
    <a className="back-link" href="#codebase"><Icon name="back" size={16} /> Codebase interviews</a>
    <div className="page-heading">
      <div>
        <div className="eyebrow">CODEBASE · {repo.title.toUpperCase()} · {LANGUAGE_LABELS[repo.lang].toUpperCase()}</div>
        <h1 ref={app.heading} tabIndex={-1}>{task.title}</h1>
        <p className="code-row-meta"><span className="pill">{KIND_LABEL[task.kind]}</span><span className="pill">{task.minutes} min</span>{progress?.completed && <span className="pill solved"><Icon name="check" size={14} />Completed</span>}</p>
      </div>
    </div>

    <div className="codebase-task-top">
      <section className="card codebase-section" aria-labelledby="codebase-brief">
        <h2 id="codebase-brief">The ticket</h2>
        {task.brief.map((text, index) => <p key={index}>{text}</p>)}
        <h3>Done when</h3>
        <ul>{task.done.map((text, index) => <li key={index}>{text}</li>)}</ul>
        <p className="muted">Start by asking clarifying questions and reading the README, then run the tests before you change anything.</p>
      </section>
      <section className="card codebase-section codebase-clock" aria-labelledby="codebase-timer">
        <h2 id="codebase-timer">Timer</h2>
        <div className={timeUp ? 'timer warn' : 'timer'} role="timer" aria-label={`Time used, of ${task.minutes} minutes`}>{formatClock(elapsed)} <span className="muted">/ {task.minutes}:00</span></div>
        <div className="button-row">
          <button className="primary" onClick={toggleTimer}><Icon name="clock" size={16} />{running ? 'Pause' : elapsed ? 'Resume' : 'Start timer'}</button>
          {timer && <button className="text-button" onClick={resetTimer}>Reset timer</button>}
        </div>
        <p role="status" className="helper">{timeUp ? 'Time is up. Keep going if you like: the walkthrough is now open below.' : ''}</p>
      </section>
    </div>

    <section className="card codebase-workspace" aria-labelledby="codebase-files">
      <div className="codebase-files">
        <h2 id="codebase-files" className="codebase-small-heading">Files</h2>
        <FileTree nodes={buildTree(paths)} active={active} changed={changed} onOpen={setActive} />
        <p className="helper">A dot marks a changed file.</p>
      </div>
      <div className="codebase-editor">
        <div className="code-toolbar">
          <h2 className="codebase-small-heading"><code>{active}</code>{changed.has(active) && <span className="muted"> · changed</span>}</h2>
          <div className="button-row">
            <button className="text-button" onClick={resetFile} disabled={busy || !changed.has(active)}>Reset file</button>
            {confirmReset
              ? <><button className="text-button" onClick={resetAll}>Confirm: reset every file</button><button className="text-button" onClick={() => setConfirmReset(false)}>Cancel</button></>
              : <button className="text-button" onClick={() => setConfirmReset(true)} disabled={busy || changed.size === 0}>Reset all</button>}
          </div>
        </div>
        <label htmlFor="codebase-editor" className="sr-only">{active}</label>
        <Editor id="codebase-editor" lang={repo.lang} value={files[active] ?? ''} describedBy="codebase-editor-help"
          onChange={value => setFiles(current => ({ ...current, [active]: value.slice(0, MAX_FILE_LENGTH) }))} />
        <p id="codebase-editor-help" className="helper">Tab indents. Press Esc, then Tab, to leave the editor. Run uses the tests you can see; Submit adds hidden review tests.{repo.lang === 'py' ? ' Python’s first run downloads about 13 MB, then works offline.' : ' TypeScript’s first run downloads the compiler, then works offline.'}{saveFailed ? ' Drafts can’t be saved in this browser.' : ''}</p>
        <div className="button-row">
          <button className="primary" onClick={() => { void run('run') }} disabled={busy} aria-busy={busy}><Icon name="bolt" size={16} />{busy ? BUSY_LABEL[phase as RunPhase] : 'Run tests'}</button>
          <button onClick={() => { void run('submit') }} disabled={busy}><Icon name="check" size={16} />Submit</button>
        </div>
        <RunProgress phase={phase} done={done} limitMs={PROJECT_TIMEOUT_MS[repo.lang]} />
        <div className="run-results" role="status" aria-live="polite">
          {result && <ProjectResults task={task} result={result} limitMs={PROJECT_TIMEOUT_MS[repo.lang]} />}
        </div>
      </div>
    </section>

    {walkthroughOpen
      ? <Walkthrough task={task} />
      : <section className="card codebase-section" aria-labelledby="codebase-walkthrough">
        <h2 id="codebase-walkthrough">Walkthrough</h2>
        <p>The model walkthrough opens after you submit or when the timer runs out. Try the task first: the practice is in the investigation.</p>
        <button className="text-button" onClick={reveal}>Show the walkthrough now</button>
      </section>}

    <SelfReview app={app} guide={guide} repo={repo} task={task} onSaved={scores => saveProgress(recordScores(readCodebaseProgress()[key], scores))} />
  </div>
}

function FileTree({ nodes, active, changed, onOpen }: { nodes: TreeNode[]; active: string; changed: ReadonlySet<string>; onOpen: (path: string) => void }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [focus, setFocus] = useState(active)
  const refs = useRef(new Map<string, HTMLLIElement>())
  const visible: { node: TreeNode; parent?: string }[] = []
  const walk = (list: TreeNode[], parent?: string) => {
    for (const node of list) {
      visible.push({ node, parent })
      if (node.children && !collapsed.has(node.path)) walk(node.children, node.path)
    }
  }
  walk(nodes)
  const focusable = visible.some(item => item.node.path === focus) ? focus : active
  const hasChange = (node: TreeNode): boolean => node.children ? node.children.some(hasChange) : changed.has(node.path)

  const move = (path: string | undefined) => {
    if (!path) return
    setFocus(path)
    refs.current.get(path)?.focus()
  }
  const setOpen = (path: string, open: boolean) => setCollapsed(current => {
    const next = new Set(current)
    if (open) next.delete(path)
    else next.add(path)
    return next
  })
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = visible.findIndex(item => item.node.path === focusable)
    const item = visible[index]
    if (!item) return
    const { node } = item
    const open = node.children && !collapsed.has(node.path)
    let handled = true
    switch (event.key) {
      case 'ArrowDown': move(visible[index + 1]?.node.path); break
      case 'ArrowUp': move(visible[index - 1]?.node.path); break
      case 'Home': move(visible[0]?.node.path); break
      case 'End': move(visible[visible.length - 1]?.node.path); break
      case 'ArrowRight':
        if (node.children && !open) setOpen(node.path, true)
        else if (node.children) move(node.children[0]?.path)
        break
      case 'ArrowLeft':
        if (open) setOpen(node.path, false)
        else move(item.parent)
        break
      case 'Enter': case ' ':
        if (node.children) setOpen(node.path, !open)
        else onOpen(node.path)
        break
      default: handled = false
    }
    if (handled) event.preventDefault()
  }

  const render = (list: TreeNode[], level: number) => list.map(node => {
    const open = node.children && !collapsed.has(node.path)
    return <li key={node.path} role="treeitem" aria-level={level} tabIndex={node.path === focusable ? 0 : -1}
      aria-expanded={node.children ? !!open : undefined} aria-selected={node.children ? undefined : node.path === active}
      ref={element => { if (element) refs.current.set(node.path, element); else refs.current.delete(node.path) }}
      onClick={event => { event.stopPropagation(); setFocus(node.path); if (node.children) setOpen(node.path, !open); else onOpen(node.path) }}
      onFocus={event => { if (event.target === event.currentTarget) setFocus(node.path) }}>
      <span className={node.path === active ? 'codebase-node active' : 'codebase-node'} style={{ paddingLeft: `${(level - 1) * 14 + 8}px` }}>
        {node.children ? <span aria-hidden="true" className="codebase-caret">{open ? '▾' : '▸'}</span> : null}
        <span className="codebase-node-name">{node.name}{node.children ? '/' : ''}</span>
        {hasChange(node) && <span className="codebase-dot" aria-label={node.children ? 'contains changes' : 'changed'} role="img" />}
      </span>
      {node.children && open && <ul role="group">{render(node.children, level + 1)}</ul>}
    </li>
  })

  return <ul className="codebase-tree" role="tree" aria-labelledby="codebase-files" onKeyDown={onKeyDown}>{render(nodes, 1)}</ul>
}

function ProjectResults({ task, result, limitMs }: { task: CodebaseTask; result: Result; limitMs: number }) {
  const { report, mode } = result
  if (report.kind === 'timeout') return <div className="run-summary fail"><strong>Stopped after {limitMs / 1000} seconds.</strong> Check for an infinite loop or a test that never finishes.</div>
  if (report.kind === 'load-error') return <div className="run-summary fail"><strong>The runner could not start.</strong> {report.error}</div>
  const diagnostics = report.diagnostics ?? []
  const diagnosticList = diagnostics.length > 0 && <details className="run-output type-errors" open>
    <summary>{diagnostics.length === 1 ? '1 type error' : `${diagnostics.length} type errors`}</summary>
    <ul>{diagnostics.slice(0, 20).map((diagnostic, index) => <li key={index}><code>{formatProjectDiagnostic(diagnostic)}</code></li>)}</ul>
  </details>
  const output = report.output && <details className="run-output"><summary>Console output</summary><pre>{report.output}</pre></details>
  if (report.kind === 'error') return <><div className="run-summary fail"><strong>The tests didn’t run.</strong><pre>{report.error}</pre></div>{diagnosticList}{output}</>
  const visible = report.outcomes.filter(outcome => !isHiddenOutcome(task, outcome.name))
  const hidden = report.outcomes.filter(outcome => isHiddenOutcome(task, outcome.name))
  const passed = report.outcomes.filter(outcome => outcome.pass).length
  const all = report.outcomes.length > 0 && passed === report.outcomes.length
  const summary = report.outcomes.length === 0 ? 'No tests were found.'
    : mode === 'submit' ? (all ? `Submitted: all ${passed} tests passed, including the hidden review tests.` : `Submitted: ${passed} of ${report.outcomes.length} tests passed.`)
      : `${passed} of ${report.outcomes.length} tests passed.`
  return <>
    <div className={all ? 'run-summary pass' : 'run-summary fail'}><strong>{summary}</strong></div>
    <ul className="test-results">
      {visible.map(outcome => <li key={outcome.name} className={outcome.pass ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={outcome.pass ? 'check' : 'x'} size={16} />{outcome.pass ? 'Passed' : 'Failed'}</span>
        <code className="test-call">{outcome.name}</code>
        {!outcome.pass && outcome.error && <pre className="codebase-error">{outcome.error}</pre>}
      </li>)}
      {hidden.map((outcome, index) => <li key={outcome.name} className={outcome.pass ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={outcome.pass ? 'check' : 'x'} size={16} />{outcome.pass ? 'Passed' : 'Failed'}</span>
        <span>Hidden review test {index + 1}</span>
      </li>)}
    </ul>
    {hidden.length > 0 && hidden.some(outcome => !outcome.pass) && <p className="helper">Hidden review tests check edge cases from the ticket. Their code stays hidden, like an interviewer’s follow-up questions.</p>}
    {diagnosticList}
    {output}
  </>
}

function Walkthrough({ task }: { task: CodebaseTask }) {
  const { walkthrough } = task
  return <section className="card codebase-section" aria-labelledby="codebase-walkthrough">
    <h2 id="codebase-walkthrough">Walkthrough</h2>
    <h3>Questions worth asking</h3>
    <ul>{walkthrough.questions.map((text, index) => <li key={index}>{text}</li>)}</ul>
    <h3>Orient</h3>
    <ul>{walkthrough.orient.map((text, index) => <li key={index}>{text}</li>)}</ul>
    <h3>The failing test to write first</h3>
    <pre className="codebase-pre">{walkthrough.failingTest}</pre>
    <h3>Trace and change</h3>
    <ol>{walkthrough.trace.map((text, index) => <li key={index}>{text}</li>)}</ol>
    <h3>Wrap up</h3>
    <ul>{walkthrough.wrapUp.map((text, index) => <li key={index}>{text}</li>)}</ul>
    <h3>Model diff</h3>
    {task.diff.map(file => <details key={file.path} className="codebase-diff">
      <summary><code>{file.path}</code></summary>
      <pre className="codebase-pre">{file.diff.split('\n').map((line, index) => <span key={index} className={line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : undefined}>{line}{'\n'}</span>)}</pre>
    </details>)}
  </section>
}

function SelfReview({ app, guide, repo, task, onSaved }: { app: AppModel; guide: CodebaseGuide; repo: CodebaseRepo; task: CodebaseTask; onSaved: (scores: Scores) => void }) {
  const [plans, setPlans] = useState<StudyPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [scores, setScores] = useState<(number | undefined)[]>([undefined, undefined, undefined, undefined])
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string; planId?: string }>()
  useEffect(() => {
    let live = true
    loadPlans().then(list => {
      if (!live) return
      setPlans(list)
      const state = readPlans()
      const started = list.find(plan => state[plan.id]?.start)
      setPlanId(started?.id ?? DEFAULT_PLANS.find(id => list.some(plan => plan.id === id)) ?? list[0]?.id ?? '')
    }, () => undefined)
    return () => { live = false }
  }, [])

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (scores.some(score => !score)) { setMessage({ ok: false, text: 'Score all four areas first.' }); return }
    if (!planId) { setMessage({ ok: false, text: 'The study plans could not load, so the scorecard has nowhere to go.' }); return }
    const state = readPlans()
    const existing = state[planId]?.scores ?? []
    if (existing.length >= MAX_SCORES) { setMessage({ ok: false, text: `That plan already has ${MAX_SCORES} scorecards. Delete an old one first.` }); return }
    const values = scores as Scores
    const card: Scorecard = { id: newEntryId('score', existing), at: app.today, kind: 'codebase', title: `${task.title} (${repo.title})`.slice(0, 300), scores: values, notes: notes.slice(0, MAX_NOTES) }
    if (!writePlans(withPlan(state, planId, entry => ({ ...entry, scores: [card, ...entry.scores] })))) { setMessage({ ok: false, text: 'The scorecard could not be saved in this browser.' }); return }
    onSaved(values)
    setMessage({ ok: true, text: `Saved. Average ${average(values).toFixed(1)} of 4.`, planId })
  }

  return <section className="card codebase-section" aria-labelledby="codebase-review">
    <h2 id="codebase-review">Self-review</h2>
    <p className="muted">Score yourself as an interviewer would. The scorecard is saved to a study plan’s mock scorecards so you can track it over time.</p>
    <form onSubmit={save}>
      <div className="codebase-review-grid">
        {guide.rubric.map((area, index) => <div className="field" key={area.id}>
          <label htmlFor={`review-${area.id}`}>{area.title}</label>
          <select id={`review-${area.id}`} value={scores[index] ?? ''} onChange={event => setScores(current => current.map((value, at) => at === index ? Number(event.target.value) || undefined : value))}>
            <option value="">Choose a score</option>
            {area.levels.map((level, at) => <option key={at} value={at + 1}>{at + 1}: {level}</option>)}
          </select>
        </div>)}
      </div>
      <div className="field">
        <label htmlFor="review-notes">Notes <span className="muted">(optional)</span></label>
        <textarea id="review-notes" rows={3} maxLength={MAX_NOTES} value={notes} onChange={event => setNotes(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="review-plan">Save to plan</label>
        <select id="review-plan" value={planId} onChange={event => setPlanId(event.target.value)}>
          {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
        </select>
      </div>
      <button className="primary" type="submit">Save scorecard</button>
    </form>
    <p role="status" className={message && !message.ok ? 'helper codebase-error-text' : 'helper'}>
      {message?.text}{message?.planId && <> <a href={`#plans/${message.planId}`}>See it in the plan’s mock scorecards</a></>}
    </p>
  </section>
}
