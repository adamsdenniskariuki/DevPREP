import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AppModel } from '../app-model'
import Editor from '../components/Editor'
import Icon from '../components/Icon'
import { ResultTable } from '../components/SqlLab'
import { MAX_CODE_LENGTH } from '../code-drafts'
import {
  duplicateSnippet, editSnippet, LANG_LABELS, makeSnippet, MAX_SNIPPET_NAME, MAX_SNIPPETS, MAX_STDIN_LENGTH, PLAYGROUND_KEY, readSnippets,
  SNIPPET_LANGS, sortSnippets, STARTERS, writeSnippets, type Snippet, type SnippetLang,
} from '../playground'
import { FREE_TIMEOUT_MS, resetPlaygroundDb, runFree, runPlaygroundSql, type FreeReport, type RunPhase, type SqlFreeReport } from '../runner/runner'
import { SQL_ROW_LIMIT } from '../runner/sql-core'
import { SAMPLE_SQL } from '../playground-sample'
import '../playground.css'

const PHASE_LABEL: Record<RunPhase, string> = { 'loading-python': 'Loading Python…', 'loading-typescript': 'Loading TypeScript…', 'loading-sql': 'Starting Postgres…', running: 'Running…' }
const DOWNLOAD_NOTE: Record<SnippetLang, string> = {
  js: '',
  ts: ' TypeScript’s first run downloads the compiler (about 3 MB compressed), then works offline.',
  py: ' Python’s first run downloads about 13 MB, then works offline.',
  sql: ' Postgres’s first run downloads about 6 MB compressed, then works offline.',
}
const SAVE_DELAY_MS = 400

type Result =
  | { lang: Exclude<SnippetLang, 'sql'>; report: FreeReport }
  | { lang: 'sql'; report: SqlFreeReport; note?: string }

function firstLoad(): Snippet[] {
  const list = readSnippets()
  let stored = true
  try { stored = window.localStorage.getItem(PLAYGROUND_KEY) !== null } catch { /* storage off */ }
  // First visit: start with a JavaScript snippet so there is something to run.
  if (list.length === 0 && !stored) {
    const first = makeSnippet([], 'js')
    writeSnippets([first])
    return [first]
  }
  return list
}

export default function PlaygroundScreen({ app, snippetId }: { app: AppModel; snippetId?: string }) {
  const { heading } = app
  useEffect(() => { heading.current?.focus() }, [heading])
  const [snippets, setSnippets] = useState<Snippet[]>(firstLoad)
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'failed'>('saved')
  const [newLang, setNewLang] = useState<SnippetLang>('js')
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [result, setResult] = useState<Result>()
  const [notice, setNotice] = useState('')
  const [nameDraft, setNameDraft] = useState<string>()
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  const current = snippetId ? snippets.find(snippet => snippet.id === snippetId) : snippets[0]

  // Autosave: write shortly after the last edit, and on leaving the page or the screen.
  const latest = useRef(snippets)
  const dirty = useRef(false)
  const save = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    setSaveState(writeSnippets(latest.current) ? 'saved' : 'failed')
  }, [])
  useEffect(() => {
    if (!dirty.current) return
    const timer = window.setTimeout(save, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [snippets, save])
  useEffect(() => {
    addEventListener('pagehide', save)
    return () => { removeEventListener('pagehide', save); save() }
  }, [save])

  function commit(next: Snippet[], immediately = false) {
    latest.current = next
    dirty.current = true
    setSnippets(next)
    setSaveState('pending')
    if (immediately) save()
  }

  function update(patch: Partial<Pick<Snippet, 'name' | 'lang' | 'code' | 'stdin'>>) {
    if (!current) return
    const next = editSnippet(current, patch)
    commit(snippets.map(snippet => snippet.id === current.id ? next : snippet))
  }

  useEffect(() => { setResult(undefined); setNameDraft(undefined) }, [current?.id])

  function open(id: string) {
    window.location.hash = `#playground/${id}`
  }

  function create(lang: SnippetLang) {
    try {
      const snippet = makeSnippet(snippets, lang)
      commit([snippet, ...snippets], true)
      setNotice(`Created “${snippet.name}”.`)
      open(snippet.id)
    } catch (error) {
      setNotice((error as Error).message)
    }
  }

  function duplicate() {
    if (!current) return
    try {
      const copy = duplicateSnippet(snippets, current)
      commit([copy, ...snippets], true)
      setNotice(`Duplicated as “${copy.name}”.`)
      open(copy.id)
    } catch (error) {
      setNotice((error as Error).message)
    }
  }

  function remove() {
    if (!current || !window.confirm(`Delete “${current.name}”? This can’t be undone.`)) return
    const rest = snippets.filter(snippet => snippet.id !== current.id)
    commit(rest, true)
    setNotice(`Deleted “${current.name}”.`)
    window.location.hash = rest.length ? `#playground/${sortSnippets(rest)[0].id}` : '#playground'
  }

  function chooseLang(lang: SnippetLang) {
    if (!current || lang === current.lang) return
    const untouched = !current.code.trim() || current.code === STARTERS[current.lang]
    update({ lang, ...untouched ? { code: STARTERS[lang] } : {} })
  }

  function finishRename() {
    if (nameDraft === undefined) return
    const name = nameDraft.trim()
    setNameDraft(undefined)
    if (name && name !== current?.name) update({ name })
  }

  async function run() {
    if (!current || phase !== 'idle') return
    save()
    setResult(undefined)
    setNotice('')
    if (current.lang === 'sql') {
      const report = await runPlaygroundSql(current.code, setPhase)
      if (!live.current) return
      setPhase('idle')
      setResult({ lang: 'sql', report })
      return
    }
    const lang = current.lang
    const report = await runFree(lang, { code: current.code, stdin: current.stdin ?? '' }, setPhase)
    if (!live.current) return
    setPhase('idle')
    setResult({ lang, report })
  }

  async function sqlAction(kind: 'sample' | 'reset') {
    if (phase !== 'idle') return
    if (kind === 'reset' && !window.confirm('Delete every table in the Playground database? This can’t be undone.')) return
    setResult(undefined)
    const report = kind === 'reset' ? await resetPlaygroundDb(setPhase) : await runPlaygroundSql(SAMPLE_SQL, setPhase)
    if (!live.current) return
    setPhase('idle')
    setResult({ lang: 'sql', report, note: kind === 'reset' ? 'The Playground database is empty.' : 'Loaded the sample tables: customers, products, orders and order_items.' })
  }

  function onKeyDownCapture(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void run()
    }
  }

  const busy = phase !== 'idle'
  const full = snippets.length >= MAX_SNIPPETS
  const hasStdin = current && current.lang !== 'sql'
  return <div className="playground-page">
    <div className="page-heading">
      <div>
        <div className="eyebrow">PRACTISE · PLAYGROUND</div>
        <h1 ref={heading} tabIndex={-1}>Playground</h1>
        <p>Write and run JavaScript, TypeScript, Python or SQL with no tests. Snippets are saved on this device.</p>
      </div>
    </div>
    <p className="sr-only" role="status">{notice}</p>
    <div className="playground-layout">
      <nav className="card playground-snippets" aria-labelledby="snippets-title">
        <h2 id="snippets-title">Snippets <span className="muted">{snippets.length} of {MAX_SNIPPETS}</span></h2>
        {snippets.length > 0 ? <ul>
          {snippets.map(snippet => <li key={snippet.id}>
            <a href={`#playground/${snippet.id}`} aria-current={snippet.id === current?.id ? 'page' : undefined}>
              <span className="snippet-name">{snippet.name}</span>
              <span className="pill">{LANG_LABELS[snippet.lang]}</span>
            </a>
          </li>)}
        </ul> : <p className="muted">No snippets yet.</p>}
        <div className="playground-new">
          <label htmlFor="new-snippet-lang">New snippet in</label>
          <div className="playground-new-row">
            <select id="new-snippet-lang" value={newLang} onChange={event => setNewLang(event.target.value as SnippetLang)}>
              {SNIPPET_LANGS.map(lang => <option key={lang} value={lang}>{LANG_LABELS[lang]}</option>)}
            </select>
            <button type="button" onClick={() => create(newLang)} disabled={full}><Icon name="spark" size={16} />New snippet</button>
          </div>
          {full && <p className="helper">You have {MAX_SNIPPETS} snippets, the most this device keeps. Delete one to make room.</p>}
        </div>
      </nav>

      {current ? <section className="card playground-panel" aria-labelledby="playground-editor-title" onKeyDownCapture={onKeyDownCapture}>
        <h2 id="playground-editor-title" className="sr-only">Editor for {current.name}</h2>
        <div className="playground-toolbar">
          <div className="playground-name">
            <label htmlFor="snippet-name">Snippet name</label>
            <input id="snippet-name" value={nameDraft ?? current.name} maxLength={MAX_SNIPPET_NAME}
              onChange={event => setNameDraft(event.target.value)} onBlur={finishRename}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); finishRename() } if (event.key === 'Escape') setNameDraft(undefined) }} />
          </div>
          <div className="playground-actions">
            <button type="button" className="text-button" onClick={duplicate} disabled={busy || full}>Duplicate</button>
            <button type="button" className="text-button danger" onClick={remove} disabled={busy}>Delete</button>
          </div>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Language">
          {SNIPPET_LANGS.map(lang => <label key={lang} className="chip"><input type="radio" name="playground-lang" checked={current.lang === lang} onChange={() => chooseLang(lang)} disabled={busy} />{LANG_LABELS[lang]}</label>)}
        </div>
        <label htmlFor="playground-editor" className="sr-only">{LANG_LABELS[current.lang]} code</label>
        <Editor key={current.id} id="playground-editor" lang={current.lang} value={current.code} onChange={code => update({ code })} describedBy="playground-help" />
        <p id="playground-help" className="helper">
          Press Ctrl+Enter (⌘+Enter on a Mac) to run. Tab indents; press Esc, then Tab, to leave the editor.
          {current.code.length >= MAX_CODE_LENGTH ? ` Snippets are capped at ${MAX_CODE_LENGTH.toLocaleString('en')} characters.` : ''}
          {DOWNLOAD_NOTE[current.lang]}
          {saveState === 'failed' ? ' This browser won’t save snippets (private mode or storage full).' : ''}
        </p>
        {hasStdin && <div className="playground-stdin">
          <label htmlFor="playground-stdin">Input (stdin)</label>
          <textarea id="playground-stdin" rows={3} spellCheck={false} value={current.stdin ?? ''} maxLength={MAX_STDIN_LENGTH} aria-describedby="playground-stdin-help"
            onChange={event => update({ stdin: event.target.value })} />
          <p id="playground-stdin-help" className="helper">{current.lang === 'py' ? 'input() reads one line at a time.' : 'readline() or input() return the next line, or null when there are none; stdin holds all of it.'}</p>
        </div>}
        <div className="button-row playground-run">
          <button type="button" className="primary" onClick={() => { void run() }} disabled={busy}><Icon name="bolt" size={16} />{phase === 'idle' ? 'Run' : PHASE_LABEL[phase]}</button>
          {current.lang === 'sql' && <>
            <button type="button" onClick={() => { void sqlAction('sample') }} disabled={busy}>Load sample data</button>
            <button type="button" className="danger-outline" onClick={() => { void sqlAction('reset') }} disabled={busy}>Reset database</button>
          </>}
          <span className="playground-save muted" aria-live="polite">{saveState === 'failed' ? 'Not saved' : saveState === 'pending' ? 'Saving…' : 'Saved on this device'}</span>
        </div>
        <div className="run-results playground-output" role="status" aria-live="polite" aria-label="Output">
          {result && (result.lang === 'sql' ? <SqlOutput report={result.report} note={result.note} /> : <FreeOutput report={result.report} lang={result.lang} />)}
        </div>
      </section> : <section className="card empty-state playground-panel">
        <h2>{snippetId ? 'That snippet isn’t on this device.' : 'No snippets yet.'}</h2>
        <p>{snippetId ? 'It may have been deleted, or saved in another browser.' : 'Start one in any language.'}</p>
        <div className="button-row">
          {SNIPPET_LANGS.map(lang => <button key={lang} type="button" onClick={() => create(lang)} disabled={full}>New {LANG_LABELS[lang]} snippet</button>)}
        </div>
      </section>}
    </div>

    <details className="card playground-limits">
      <summary>How the Playground works, and its limits</summary>
      <ul>
        <li><strong>JavaScript and TypeScript</strong> run in a background worker. <code>console.log</code> prints; top-level <code>await</code> works; a top-level <code>return</code> shows a value. <code>readline()</code> and <code>input()</code> read the input box line by line, and <code>stdin</code> holds all of it. Pending timers are waited for. TypeScript is type-checked first: type errors are listed, and the code still runs. There is no DOM and no <code>import</code>.</li>
        <li><strong>Python</strong> runs on Pyodide with the standard library only: no extra packages. <code>print</code> writes output and <code>input()</code> reads the input box (EOFError when it runs out). The value of a final expression is shown, like a REPL.</li>
        <li><strong>SQL</strong> runs on Postgres (PGlite) with its own database, kept in this browser between visits and separate from the exercises. Separate statements with <code>;</code>. Each result set shows as a table (first {SQL_ROW_LIMIT} rows), and other statements show their row counts. A batch runs as one transaction: if a statement fails, the whole batch is rolled back.</li>
        <li><strong>Time limits:</strong> JavaScript {FREE_TIMEOUT_MS.js / 1000} s, TypeScript {FREE_TIMEOUT_MS.ts / 1000} s, Python {FREE_TIMEOUT_MS.py / 1000} s, SQL {FREE_TIMEOUT_MS.sql / 1000} s. A run that goes over is stopped and the runner restarts.</li>
        <li><strong>No network:</strong> fetch, XMLHttpRequest, WebSocket and similar are turned off inside the runners, so code can’t send or load anything. Everything works offline once each language has loaded once.</li>
        <li><strong>Storage:</strong> up to {MAX_SNIPPETS} snippets of up to {MAX_CODE_LENGTH.toLocaleString('en')} characters each. They are included when you export a backup.</li>
      </ul>
    </details>
  </div>
}

function Timing({ ms }: { ms: number }) {
  return <span className="muted"> · {ms < 1 ? 'under 1 ms' : `${ms.toLocaleString('en')} ms`}</span>
}

function FreeOutput({ report, lang }: { report: FreeReport; lang: Exclude<SnippetLang, 'sql'> }) {
  if (report.kind === 'timeout') return <div className="run-summary fail"><strong>Stopped after {report.limitMs / 1000} seconds.</strong> Check for an infinite loop or a timer that never stops. The runner was restarted, so you can run again.</div>
  if (report.kind === 'load-error') return <div className="run-summary fail"><strong>{LANG_LABELS[lang]} could not start.</strong> {report.error}</div>
  const diagnostics = report.diagnostics ?? []
  return <>
    <div className={report.kind === 'done' ? 'run-summary pass' : 'run-summary fail'}>
      <strong>{report.kind === 'done' ? 'Finished' : report.line ? `Error on line ${report.line}` : 'Error'}</strong><Timing ms={report.ms} />
      {report.error && <pre className="playground-error">{report.error}</pre>}
    </div>
    {diagnostics.length > 0 && <details className="run-output type-errors" open>
      <summary>{diagnostics.length === 1 ? '1 type error' : `${diagnostics.length} type errors`} · the code still ran</summary>
      <ul>{diagnostics.slice(0, 20).map((diagnostic, index) => <li key={index}><code>Line {diagnostic.line}:{diagnostic.column}</code> {diagnostic.message} <span className="muted">TS{diagnostic.code}</span></li>)}</ul>
    </details>}
    <h3 className="playground-output-title">Output</h3>
    <pre className="playground-stdout">{report.output || <span className="muted">(no output)</span>}</pre>
    {report.value !== undefined && <>
      <h3 className="playground-output-title">{lang === 'py' ? 'Last expression' : 'Return value'}</h3>
      <pre className="playground-value">{report.value}</pre>
    </>}
  </>
}

function SqlOutput({ report, note }: { report: SqlFreeReport; note?: string }) {
  if (report.kind === 'timeout') return <div className="run-summary fail"><strong>Stopped after {report.limitMs / 1000} seconds.</strong> Check for a runaway query, such as a recursive CTE with no end. Postgres was restarted; your database is as it was after the last finished run.</div>
  if (report.kind === 'load-error') return <div className="run-summary fail"><strong>Postgres could not start.</strong> {report.error}</div>
  if (report.kind === 'error') return <div className="run-summary fail"><strong>Error</strong><Timing ms={report.ms} /><pre className="playground-error">{report.error}</pre><p className="helper">Nothing in this batch was saved: it runs as one transaction.</p></div>
  return <>
    <div className="run-summary pass"><strong>{note ?? `Ran ${report.results.length} ${report.results.length === 1 ? 'statement' : 'statements'}`}</strong>{!note && <Timing ms={report.ms} />}</div>
    {report.results.map((set, index) => set.columns
      ? <div key={index} className="playground-result">
        <ResultTable caption={`Result ${index + 1}${set.command ? ` · ${set.command}` : ''} · ${set.rowCount === 1 ? '1 row' : `${set.rowCount ?? set.rows!.length} rows`}${set.truncated ? ` (first ${SQL_ROW_LIMIT} shown)` : ''}`} columns={set.columns} rows={set.rows!} />
      </div>
      : <p key={index} className="playground-command"><span className="pill">{index + 1}</span> {set.command ?? 'Statement'} {set.rowCount !== undefined && ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'COPY', 'SELECT'].includes(set.command ?? '') ? `· ${set.rowCount === 1 ? '1 row' : `${set.rowCount} rows`} affected` : '· done'}</p>)}
  </>
}
