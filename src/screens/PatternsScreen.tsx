import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import Editor from '../components/Editor'
import DiagramFigure from '../components/Diagram'
import PatternVisualiser from '../components/PatternVisualiser'
import RunResults from '../components/RunResults'
import { runCode, type RunPhase, type RunReport } from '../runner/runner'
import { stripMarkers } from '../patterns/markers'
import { PICKER_ROUND, loadPatterns, patternIndex, patternTree, pickerRound, pickerScore } from '../patterns'
import { patternPageDone } from '../gamification'
import { problemIndex } from '../problems'
import { PATTERN_LANGS, PATTERN_LANG_LABEL } from '../pattern-types'
import type { PatternLang, PatternPage, PatternSummary } from '../pattern-types'
import type { QuizItem } from '../guide-types'
import '../field-guide.css'
import '../patterns.css'

const ROLE: Record<PatternPage['problems'][number]['role'], string> = { 'warm-up': 'Warm-up', core: 'Core', stretch: 'Stretch' }

/** `view` is a page id, 'pick', 'cheatsheet', or undefined for the course home. App validates it. */
export default function PatternsScreen({ app, view }: { app: AppModel; view?: string }) {
  // This screen is lazy, so it may mount after App's route-change focus has already run.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, view])
  if (view === 'pick') return <Picker app={app} />
  if (view === 'cheatsheet') return <CheatSheet app={app} />
  const summary = view ? patternIndex.find(item => item.id === view) : undefined
  return summary ? <PageLoader app={app} summary={summary} /> : <Home app={app} />
}

function Home({ app }: { app: AppModel }) {
  const { progress } = app
  const done = patternIndex.filter(item => patternPageDone(progress, item.id)).length
  const row = (page: PatternSummary, n: string) => {
    const finished = patternPageDone(progress, page.id)
    const entry = progress.patterns?.[page.id]
    return <li key={page.id} className="pattern-row">
      <span className="step-number" aria-hidden="true">{finished ? <Icon name="check" size={18} /> : n}</span>
      <div className="pattern-row-copy">
        <h3><a href={`#patterns/${page.id}`}>{page.title}</a></h3>
        <p>{page.summary}</p>
        <p className="muted">{page.minutes} min · {page.level === 'sse' ? 'SSE' : 'SE'}{entry?.quiz ? ` · Quick check best ${entry.quiz.best}%` : ''}{entry?.exercise ? ` · Exercise passed in ${Object.keys(entry.exercise).map(lang => PATTERN_LANG_LABEL[lang as PatternLang]).join(', ')}` : ''}</p>
      </div>
      <span className={finished ? 'pill solved' : 'pill'}>{finished ? 'Learned' : entry ? 'Started' : 'Not started'}</span>
    </li>
  }
  return <>
    <a className="back-link" href="#practice"><Icon name="back" size={16} /> Practice</a>
    <div className="page-heading"><div><div className="eyebrow">PRACTICE · PATTERNS</div><h1 ref={app.heading} tabIndex={-1}>Algorithm patterns</h1><p>Learn the moves behind most interview problems. Each pattern has a picture, a step-through, a template and a short exercise.</p></div><span className="pill">{done} of {patternIndex.length} learned</span></div>
    <div className="pattern-tools">
      <a className="tool-card live" href="#patterns/pick"><span className="tool-icon"><Icon name="target" /></span><h3>Pattern picker</h3><p>{PICKER_ROUND} quick “which pattern?” questions.</p><span className="pill">{app.progress.patternPicker ? `Best ${app.progress.patternPicker.best}/${PICKER_ROUND}` : 'Not tried'}</span></a>
      <a className="tool-card live" href="#patterns/cheatsheet"><span className="tool-icon"><Icon name="layers" /></span><h3>Cheat sheet</h3><p>Every pattern on one printable page.</p></a>
    </div>
    <section aria-labelledby="pattern-order-title">
      <h2 id="pattern-order-title" className="section-title">Suggested learning order</h2>
      <ol className="pattern-order">
        {patternTree().map(({ page, children }, i) => <Fragment key={page.id}>
          {row(page, String(i + 1))}
          {children.map((child, j) => row(child, `${i + 1}.${j + 1}`))}
        </Fragment>)}
      </ol>
    </section>
  </>
}

function PageLoader({ app, summary }: { app: AppModel; summary: PatternSummary }) {
  const [page, setPage] = useState<PatternPage>()
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    loadPatterns().then(all => { if (live) setPage(all.get(summary.id)) }, () => { if (live) setError('This pattern could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [summary.id])
  const parent = summary.parent ? patternIndex.find(item => item.id === summary.parent) : undefined
  const children = patternIndex.filter(item => item.parent === summary.id)
  return <>
    <a className="back-link" href="#patterns"><Icon name="back" size={16} /> All patterns</a>
    <div className="page-heading"><div><div className="eyebrow">PATTERNS{parent ? ` · ${parent.title.toUpperCase()}` : ''} · {summary.minutes} MIN</div><h1 ref={app.heading} tabIndex={-1}>{summary.title}</h1><p>{summary.summary}</p></div>{patternPageDone(app.progress, summary.id) && <span className="pill solved">Learned</span>}</div>
    {parent && <p className="pattern-subnav">Part of <a href={`#patterns/${parent.id}`}>{parent.title}</a>.</p>}
    {children.length > 0 && <nav className="pattern-subnav" aria-label="Sub-patterns"><span>Sub-patterns:</span>{children.map(child => <a key={child.id} href={`#patterns/${child.id}`}>{child.title}</a>)}</nav>}
    {error ? <div className="alert" role="alert">{error}</div> : page ? <PatternBody key={page.id} app={app} page={page} /> : <p role="status">Loading pattern…</p>}
  </>
}

function Section({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return <section className="card pattern-section" aria-labelledby={`ps-${id}`}>
    <h2 id={`ps-${id}`}><span className="pattern-step" aria-hidden="true">{n}</span>{title}</h2>
    {children}
  </section>
}

function PatternBody({ app, page }: { app: AppModel; page: PatternPage }) {
  return <div className="pattern-page">
    <Section n={1} id="recognise" title="Recognise it">
      <p>{page.idea}</p>
      <table className="pattern-signals">
        <caption className="sr-only">Signals that suggest this pattern</caption>
        <thead><tr><th scope="col">When you see…</th><th scope="col">Think…</th></tr></thead>
        <tbody>{page.recognise.signals.map(signal => <tr key={signal.see}><td>{signal.see}</td><td>{signal.think}</td></tr>)}</tbody>
      </table>
      <h3>Phrases that hint at it</h3>
      <ul>{page.recognise.phrasings.map(phrase => <li key={phrase}>“{phrase}”</li>)}</ul>
    </Section>
    <Section n={2} id="picture" title="Picture it">
      <DiagramFigure diagram={page.picture} number={1} />
    </Section>
    <Section n={3} id="visualise" title="Watch it run">
      <p className="muted">Step through the code. The highlighted line is the one that runs next.</p>
      <PatternVisualiser spec={page.visualiser} />
    </Section>
    <Section n={4} id="template" title="Template">
      <p className="pattern-oneliner"><strong>In one line: </strong>{page.oneLiner}</p>
      <Template page={page} />
    </Section>
    <Section n={5} id="exercise" title="Try it">
      <Exercise app={app} page={page} />
      <h3>Then solve these</h3>
      <ul className="pattern-problems">
        {page.problems.map(link => { const problem = problemIndex.find(item => item.id === link.id); return problem && <li key={link.id}><a className="text-button" href={`#code/${link.id}`}><Icon name="code" size={16} />{problem.title}</a> <span className="pill">{ROLE[link.role]}</span>{app.progress.solved?.[link.id] && <span className="pill solved">Solved</span>}</li> })}
      </ul>
    </Section>
    <Section n={6} id="complexity" title="Complexity">
      <dl className="pattern-complexity"><div><dt>Time</dt><dd>{page.complexity.time}</dd></div><div><dt>Space</dt><dd>{page.complexity.space}</dd></div></dl>
      <p>{page.complexity.why}</p>
    </Section>
    <Section n={7} id="mistakes" title="Common mistakes">
      <ul>{page.mistakes.map(mistake => <li key={mistake}>{mistake}</li>)}</ul>
    </Section>
    <Section n={8} id="check" title="Quick check">
      <Quiz app={app} page={page} />
      <p className="pattern-tip"><strong>Interview tip: </strong>{page.interviewTip}</p>
    </Section>
  </div>
}

function Template({ page }: { page: PatternPage }) {
  const [lang, setLang] = useState<PatternLang>('py')
  return <>
    <div className="segmented" role="radiogroup" aria-label="Template language">
      {PATTERN_LANGS.map(item => <label key={item} className="chip"><input type="radio" name={`tpl-${page.id}`} checked={lang === item} onChange={() => setLang(item)} />{PATTERN_LANG_LABEL[item]}</label>)}
    </div>
    <label htmlFor="pattern-template" className="sr-only">{PATTERN_LANG_LABEL[lang]} template</label>
    <Editor id="pattern-template" lang={lang} value={stripMarkers(page.template[lang]).code} onChange={() => {}} readOnly interview />
  </>
}

function Exercise({ app, page }: { app: AppModel; page: PatternPage }) {
  const { exercise } = page
  const [lang, setLang] = useState<PatternLang>('py')
  const [code, setCode] = useState<Record<PatternLang, string>>(() => ({ ...exercise.starter }))
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [result, setResult] = useState<{ lang: PatternLang; report: RunReport; message?: string }>()
  const [hints, setHints] = useState(0)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const passed = app.progress.patterns?.[page.id]?.exercise ?? {}
  const fnName = (item: PatternLang) => item === 'py' ? exercise.function.py : exercise.function.js

  async function run() {
    const runLang = lang
    setResult(undefined)
    const report = await runCode(runLang, { code: code[runLang], name: fnName(runLang), cases: [...exercise.tests, ...exercise.hiddenTests] }, setPhase)
    if (!live.current) return
    setPhase('idle')
    let message: string | undefined
    if (report.kind === 'done' && report.outcomes.every(outcome => outcome.pass)) {
      const gained = app.passPatternExercise(page.id, runLang)
      message = `All ${report.outcomes.length} tests passed${gained ? ` · +${gained} XP` : ''}.`
    }
    setResult({ lang: runLang, report, message })
  }
  function reset() {
    if (code[lang] !== exercise.starter[lang] && !window.confirm('Replace your code with the starter? Your current code will be lost.')) return
    setCode(current => ({ ...current, [lang]: exercise.starter[lang] }))
  }

  const busy = phase !== 'idle'
  return <div className="pattern-exercise">
    <p>{exercise.prompt}</p>
    <div className="segmented" role="radiogroup" aria-label="Exercise language">
      {PATTERN_LANGS.map(item => <label key={item} className="chip"><input type="radio" name={`ex-${page.id}`} checked={lang === item} onChange={() => setLang(item)} disabled={busy} />{PATTERN_LANG_LABEL[item]}{passed[item] && <><Icon name="check" size={14} /><span className="sr-only"> (passed)</span></>}</label>)}
    </div>
    <label htmlFor="pattern-exercise" className="sr-only">{PATTERN_LANG_LABEL[lang]} code</label>
    <Editor id="pattern-exercise" lang={lang} value={code[lang]} onChange={value => setCode(current => ({ ...current, [lang]: value }))} describedBy="pattern-exercise-help" />
    <p id="pattern-exercise-help" className="helper">Tab indents. Press Esc, then Tab, to leave the editor.{lang === 'py' ? ' Python’s first run downloads about 13 MB, then works offline.' : ''}</p>
    <div className="code-actions">
      <button className="primary" onClick={() => { void run() }} disabled={busy}><Icon name="bolt" size={16} />{phase === 'loading-python' ? 'Loading Python…' : phase === 'loading-typescript' ? 'Loading TypeScript…' : phase === 'running' ? 'Running…' : 'Run tests'}</button>
      <button onClick={reset} disabled={busy}>Reset to starter</button>
      {hints < exercise.hints.length && <button className="text-button" onClick={() => setHints(hints + 1)}>Show a hint</button>}
    </div>
    {hints > 0 && <ol className="pattern-hints" aria-label="Hints">{exercise.hints.slice(0, hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
    <div className="run-results" role="status" aria-live="polite">
      {result && <RunResults tests={exercise.tests} fn={fnName(result.lang)} lang={result.lang === 'py' ? 'py' : 'js'} typescript={result.lang === 'ts'} report={result.report} message={result.message} />}
    </div>
  </div>
}

function Quiz({ app, page }: { app: AppModel; page: PatternPage }) {
  const [answers, setAnswers] = useState<(number | undefined)[]>([])
  const [result, setResult] = useState<{ percent: number; xp: number }>()
  const best = app.progress.patterns?.[page.id]?.quiz?.best
  const ready = page.quiz.every((_, i) => answers[i] !== undefined)
  function submit() {
    const right = page.quiz.filter((item, i) => answers[i] === item.answer).length
    const percent = Math.round(right / page.quiz.length * 100)
    setResult({ percent, xp: app.scorePatternQuiz(page.id, percent) })
  }
  return <div className="fg-quiz">
    <div className="section-heading">{best !== undefined && <span className="pill">Best {best}%</span>}</div>
    <p className="muted">These questions and the recognition signals also join your DSA flashcards.</p>
    <ol className="fg-questions">
      {page.quiz.map((item: QuizItem, q) => <li key={q}>
        <fieldset disabled={!!result}>
          <legend>{item.question}</legend>
          {item.choices.map((choice, c) => {
            const mark = result ? c === item.answer ? 'right' : answers[q] === c ? 'wrong' : '' : ''
            return <label key={c} className={`fg-choice ${mark}`}>
              <input type="radio" name={`pq-${page.id}-${q}`} checked={answers[q] === c} onChange={() => setAnswers(prev => { const next = [...prev]; next[q] = c; return next })} />
              <span>{choice}</span>
              {mark === 'right' && <span className="fg-mark"><Icon name="check" size={16} /><span className="sr-only">Correct answer</span></span>}
              {mark === 'wrong' && <span className="fg-mark"><Icon name="x" size={16} /><span className="sr-only">Your answer, incorrect</span></span>}
            </label>
          })}
        </fieldset>
        {result && <p className="fg-explain">{item.explain}</p>}
      </li>)}
    </ol>
    {result
      ? <div className="fg-quiz-result" role="status"><strong>{result.percent}%</strong> correct{result.xp > 0 ? ` · +${result.xp} XP` : ''}<button type="button" className="text-button" onClick={() => { setAnswers([]); setResult(undefined) }}>Try again</button></div>
      : <button type="button" className="primary" disabled={!ready} onClick={submit}>Check answers</button>}
  </div>
}

function Picker({ app }: { app: AppModel }) {
  const [seed, setSeed] = useState(() => Date.now() % 2147483647)
  const questions = useMemo(() => pickerRound(seed), [seed])
  const [answers, setAnswers] = useState<(string | undefined)[]>([])
  const [index, setIndex] = useState(0)
  const [summary, setSummary] = useState<{ score: number; xp: number }>()
  const status = useRef<HTMLDivElement>(null)
  const question = questions[index]
  const answered = answers[index]
  const title = (id: string) => patternIndex.find(item => item.id === id)?.title ?? id

  function choose(id: string) {
    if (answered) return
    setAnswers(prev => { const next = [...prev]; next[index] = id; return next })
  }
  function next() {
    if (index + 1 < questions.length) { setIndex(index + 1); return }
    const score = pickerScore(questions, answers)
    setSummary({ score, xp: app.finishPicker(score) })
  }
  function restart() {
    setSeed(value => (value * 48271) % 2147483647 || 1)
    setAnswers([])
    setIndex(0)
    setSummary(undefined)
  }
  useEffect(() => { if (answered || summary) status.current?.focus() }, [answered, summary])

  return <>
    <a className="back-link" href="#patterns"><Icon name="back" size={16} /> All patterns</a>
    <div className="page-heading"><div><div className="eyebrow">PATTERNS · PICKER</div><h1 ref={app.heading} tabIndex={-1}>Which pattern?</h1><p>Read the problem. Pick the pattern you would reach for first.</p></div>{app.progress.patternPicker && <span className="pill">Best {app.progress.patternPicker.best}/{PICKER_ROUND}</span>}</div>
    {questions.length === 0 ? <p>Publish at least two patterns to use the picker.</p> : summary
      ? <section className="card picker-summary" aria-labelledby="picker-summary-title">
        <div ref={status} tabIndex={-1} role="status"><h2 id="picker-summary-title">You got {summary.score} of {questions.length}{summary.xp > 0 ? ` · +${summary.xp} XP` : ''}</h2></div>
        <ol className="picker-review">{questions.map((item, i) => <li key={i}><p>{item.prompt}</p><p className={answers[i] === item.answer ? 'picker-right' : 'picker-wrong'}>{answers[i] === item.answer ? <Icon name="check" size={16} /> : <Icon name="x" size={16} />}{answers[i] === item.answer ? 'Right: ' : `You chose ${title(answers[i] ?? '')}. Answer: `}{title(item.answer)}</p></li>)}</ol>
        <div className="code-actions"><button className="primary" onClick={restart}>New round</button><a className="text-button" href="#patterns">Back to patterns</a></div>
      </section>
      : <section className="card picker-question" aria-labelledby="picker-q-title">
        <p className="eyebrow">QUESTION {index + 1} OF {questions.length}</p>
        <h2 id="picker-q-title" className="picker-prompt">{question.prompt}</h2>
        <fieldset disabled={!!answered}>
          <legend className="sr-only">Pattern</legend>
          {question.choices.map(id => {
            const mark = answered ? id === question.answer ? 'right' : answered === id ? 'wrong' : '' : ''
            return <label key={id} className={`fg-choice ${mark}`}>
              <input type="radio" name={`pick-${index}`} checked={answered === id} onChange={() => choose(id)} />
              <span>{title(id)}</span>
              {mark === 'right' && <span className="fg-mark"><Icon name="check" size={16} /><span className="sr-only">Correct answer</span></span>}
              {mark === 'wrong' && <span className="fg-mark"><Icon name="x" size={16} /><span className="sr-only">Your answer, incorrect</span></span>}
            </label>
          })}
        </fieldset>
        {answered && <div ref={status} tabIndex={-1} className="fg-explain picker-explain" role="status"><strong>{answered === question.answer ? 'Right.' : `Not quite: this is ${title(question.answer)}.`}</strong> {question.explain}</div>}
        {answered && <button className="primary" onClick={next}>{index + 1 < questions.length ? 'Next question' : 'See results'}<Icon name="arrow" size={16} /></button>}
      </section>}
  </>
}

function CheatSheet({ app }: { app: AppModel }) {
  return <>
    <a className="back-link" href="#patterns"><Icon name="back" size={16} /> All patterns</a>
    <div className="page-heading"><div><div className="eyebrow">PATTERNS · CHEAT SHEET</div><h1 ref={app.heading} tabIndex={-1}>Pattern cheat sheet</h1><p>Every pattern on one page: the signal, the idea and the cost.</p></div><button type="button" className="print-button" onClick={() => window.print()}><Icon name="book" size={16} />Print</button></div>
    <div className="cheat-wrap">
      <table className="cheat-sheet">
        <caption className="sr-only">Algorithm patterns</caption>
        <thead><tr><th scope="col">Pattern</th><th scope="col">Signal</th><th scope="col">Core idea</th><th scope="col">Template</th><th scope="col">Time</th><th scope="col">Space</th></tr></thead>
        <tbody>
          {patternTree().flatMap(({ page, children }) => [page, ...children]).map(page => <tr key={page.id} className={page.parent ? 'cheat-sub' : undefined}>
            <th scope="row"><a href={`#patterns/${page.id}`}>{page.title}</a></th>
            <td>{page.signals[0].see}</td>
            <td>{page.idea}</td>
            <td><code>{page.oneLiner}</code></td>
            <td>{page.time}</td>
            <td>{page.space}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </>
}
