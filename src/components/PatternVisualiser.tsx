import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import Editor from './Editor'
import Icon from './Icon'
import { getTracer } from '../patterns/tracers'
import type { ArrayView, GridView, ListView, MapView, Trace, TreeView, VarValue } from '../patterns/tracers'
import { layoutTree } from '../patterns/layout'
import { stripMarkers } from '../patterns/markers'
import type { PatternVisualiserSpec } from '../pattern-types'

type VisLang = 'py' | 'js'
const LANG_LABEL: Record<VisLang, string> = { py: 'Python', js: 'JavaScript' }
const reducedQuery = '(prefers-reduced-motion: reduce)'
const STEP_MS = 1100
const REDUCED_STEP_MS = 1800

function subscribe(callback: () => void) {
  const query = window.matchMedia?.(reducedQuery)
  query?.addEventListener('change', callback)
  return () => query?.removeEventListener('change', callback)
}
function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => !!window.matchMedia?.(reducedQuery).matches, () => false)
}

function show(value: VarValue | undefined) {
  if (value === null || value === undefined) return '—'
  return String(value)
}

function ArrayRow({ view }: { view: ArrayView }) {
  const [lo, hi] = view.window ?? [-1, -2]
  return <div className="pv-array">
    <p className="pv-array-label">{view.label}</p>
    {view.values.length === 0 ? <p className="muted pv-empty">Empty</p> : <ol className="pv-cells" aria-label={view.label}>
      {view.values.map((value, index) => {
        const pointers = view.pointers?.filter(pointer => pointer.index === index).map(pointer => pointer.name) ?? []
        const inWindow = index >= lo && index <= hi
        const marked = view.marked?.includes(index)
        const states = [inWindow && 'in window', marked && 'highlighted', pointers.length && `pointer ${pointers.join(', ')}`].filter(Boolean).join('; ')
        return <li key={index} className={['pv-cell', inWindow && 'in-window', marked && 'marked', pointers.length && 'pointed'].filter(Boolean).join(' ')}>
          <span className="pv-index" aria-hidden="true">{index}</span>
          <span className="pv-value"><span className="sr-only">Index {index}: </span>{value}{states && <span className="sr-only"> ({states})</span>}</span>
          <span className="pv-pointers" aria-hidden="true">{pointers.map(name => <span key={name} className="pv-pointer">{name}</span>)}</span>
        </li>
      })}
    </ol>}
  </div>
}

/** Where a node's next pointer goes, as a short arrow and as words for screen readers. */
function nextLink(index: number, next: number | null): [string, string] {
  if (next === null) return ['∅', 'next is null']
  if (next === index + 1) return ['→', `next is node ${next}`]
  if (next === index - 1) return ['←', `next is node ${next}`]
  return [`→${next}`, `next is node ${next}`]
}

function ListRow({ view }: { view: ListView }) {
  return <div className="pv-array">
    <p className="pv-array-label">{view.label}</p>
    {view.values.length === 0 ? <p className="muted pv-empty">Empty</p> : <ol className="pv-cells pv-list" aria-label={view.label}>
      {view.values.map((value, index) => {
        const pointers = view.pointers?.filter(pointer => pointer.index === index).map(pointer => pointer.name) ?? []
        const marked = view.marked?.includes(index)
        const dropped = view.dropped?.includes(index)
        const [arrow, words] = nextLink(index, view.next[index])
        const states = [(view.head ?? 0) === index && 'head', dropped && 'removed', marked && 'highlighted', pointers.length && `pointer ${pointers.join(', ')}`].filter(Boolean).join('; ')
        return <li key={index} className={['pv-cell', 'pv-node', marked && 'marked', dropped && 'dropped', pointers.length && 'pointed'].filter(Boolean).join(' ')}>
          <span className="pv-index" aria-hidden="true">{index}</span>
          <span className="pv-value"><span className="sr-only">Node {index}: </span>{value}<span className="pv-next" aria-hidden="true">{arrow}</span><span className="sr-only">, {words}{states && ` (${states})`}</span></span>
          <span className="pv-pointers" aria-hidden="true">{pointers.map(name => <span key={name} className="pv-pointer">{name}</span>)}</span>
        </li>
      })}
    </ol>}
  </div>
}

const TREE_ROW = 60

function TreePanel({ view }: { view: TreeView }) {
  const { pos, columns, rows } = layoutTree(view.nodes)
  const at = (index: number) => ({ x: (pos[index].x + 0.5) / columns * 100, y: pos[index].y * TREE_ROW + 20 })
  const parentOf = new Map<number, number>()
  view.nodes.forEach((node, index) => node.children.forEach(child => { if (child !== null) parentOf.set(child, index) }))
  return <div className="pv-array">
    <p className="pv-array-label">{view.label}</p>
    {view.nodes.length === 0 ? <p className="muted pv-empty">Empty</p> : <div className="pv-tree" style={{ height: rows * TREE_ROW }}>
      <svg className="pv-tree-edges" aria-hidden="true" focusable="false" viewBox={`0 0 100 ${rows * TREE_ROW}`} preserveAspectRatio="none">
        {[...parentOf].map(([child, parent]) => {
          const a = at(parent)
          const b = at(child)
          return <line key={child} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
        })}
      </svg>
      <ol aria-label={view.label}>
        {view.nodes.map((node, index) => {
          const pointers = view.pointers?.filter(pointer => pointer.index === index).map(pointer => pointer.name) ?? []
          const active = view.active?.includes(index)
          const marked = view.marked?.includes(index)
          const parent = parentOf.get(index)
          const states = [node.end && 'ends a word', active && 'in play', marked && 'done', pointers.length && `pointer ${pointers.join(', ')}`].filter(Boolean).join('; ')
          const { x } = at(index)
          return <li key={index} className={['pv-tnode', node.end && 'end', active && 'active', marked && 'marked', pointers.length && 'pointed'].filter(Boolean).join(' ')} style={{ left: `${x}%`, top: pos[index].y * TREE_ROW }}>
            <span className="pv-value">{parent === undefined ? <span className="sr-only">Root: </span> : <span className="sr-only">Child of {view.nodes[parent].label}: </span>}{node.label}{states && <span className="sr-only"> ({states})</span>}</span>
            <span className="pv-pointers" aria-hidden="true">{pointers.map(name => <span key={name} className="pv-pointer">{name}</span>)}</span>
          </li>
        })}
      </ol>
    </div>}
  </div>
}

function GridPanel({ view }: { view: GridView }) {
  const isVisited = (r: number, c: number) => view.visited?.some(([vr, vc]) => vr === r && vc === c)
  return <div className="pv-array">
    <p className="pv-array-label">{view.label}</p>
    <table className="pv-grid">
      <caption className="sr-only">{view.label}</caption>
      <tbody>
        {view.cells.map((row, r) => <tr key={r}>
          {row.map((value, c) => {
            const current = view.current?.[0] === r && view.current?.[1] === c
            const visited = isVisited(r, c)
            const states = [current && 'current cell', visited && 'visited'].filter(Boolean).join('; ')
            return <td key={c} className={['pv-gcell', visited && 'visited', current && 'current'].filter(Boolean).join(' ')}>
              <span className="pv-value"><span className="sr-only">Row {r}, column {c}: </span>{value}{states && <span className="sr-only"> ({states})</span>}</span>
            </td>
          })}
        </tr>)}
      </tbody>
    </table>
  </div>
}

function MapPanel({ map }: { map: MapView }) {
  return <div className="pv-map">
    <p className="pv-array-label">{map.label}</p>
    {map.entries.length === 0 ? <p className="muted pv-empty">Empty</p> : <ul className="pv-map-entries">
      {map.entries.map(([key, value]) => <li key={key} className={map.highlight === key ? 'pv-entry active' : 'pv-entry'}>
        <span className="pv-key">{key}</span><span aria-hidden="true">→</span><span className="sr-only"> maps to </span><span>{value}</span>
        {map.highlight === key && <span className="sr-only"> (this step)</span>}
      </li>)}
    </ul>}
  </div>
}

/** A data-driven step-through: a tracer turns an input into frames, and each frame drives the view, code line and text. */
export default function PatternVisualiser({ spec }: { spec: PatternVisualiserSpec }) {
  const tracer = getTracer(spec.tracer)!
  const uid = useId()
  const reduced = useReducedMotion()
  const [lang, setLang] = useState<VisLang>('py')
  const [inputs, setInputs] = useState<Record<string, string>>(spec.examples[0].input)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [trace, setTrace] = useState<Trace>(() => {
    const parsed = tracer.parse(spec.examples[0].input)
    return tracer.run(parsed.ok ? parsed.args : [])
  })
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const shown = useMemo(() => stripMarkers(spec.code[lang]), [spec.code, lang])
  const last = trace.frames.length - 1
  const current = trace.frames[Math.min(frame, last)]

  useEffect(() => {
    if (!playing) return
    timer.current = window.setInterval(() => setFrame(value => value + 1), reduced ? REDUCED_STEP_MS : STEP_MS)
    return () => window.clearInterval(timer.current)
  }, [playing, reduced])
  useEffect(() => { if (frame >= last) setPlaying(false) }, [frame, last])

  function load(input: Record<string, string>) {
    setInputs(input)
    const parsed = tracer.parse(input)
    if (!parsed.ok) { setErrors(parsed.errors); return }
    setErrors({})
    setPlaying(false)
    setTrace(tracer.run(parsed.args))
    setFrame(0)
  }
  const step = (delta: number) => { setPlaying(false); setFrame(value => Math.max(0, Math.min(last, value + delta))) }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1) }
    else if (event.key === 'Home') { event.preventDefault(); step(-last) }
    else if (event.key === 'End') { event.preventDefault(); step(last) }
  }

  return <div className={reduced ? 'pv reduced' : 'pv'}>
    <div className="pv-examples" role="group" aria-label="Examples">
      <span className="muted">Try:</span>
      {spec.examples.map(example => <button key={example.label} type="button" className="pv-example" onClick={() => load(example.input)}>{example.label}</button>)}
    </div>
    <div className="pv-stage" tabIndex={0} role="group" aria-roledescription="step-through" aria-label="Visualiser. Use the left and right arrow keys to step." onKeyDown={onKey} data-testid="pv-stage">
      <p className="pv-text" aria-live="polite"><span className="pv-count">Step {Math.min(frame, last) + 1} of {last + 1}.</span> {current.text}</p>
      <div className="pv-views">
        {current.view.trees?.map(view => <TreePanel key={view.name} view={view} />)}
        {current.view.grids?.map(view => <GridPanel key={view.name} view={view} />)}
        {current.view.lists?.map(view => <ListRow key={view.name} view={view} />)}
        {current.view.arrays.map(view => <ArrayRow key={view.name} view={view} />)}
        {current.view.map && <MapPanel map={current.view.map} />}
      </div>
    </div>
    <div className="pv-controls">
      <button type="button" onClick={() => step(-1)} disabled={frame === 0}><Icon name="back" size={16} />Back</button>
      <button type="button" className="primary" onClick={() => { if (frame >= last) setFrame(0); setPlaying(!playing) }} aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</button>
      <button type="button" onClick={() => step(1)} disabled={frame >= last}>Step<Icon name="arrow" size={16} /></button>
      <button type="button" className="text-button" onClick={() => { setPlaying(false); setFrame(0) }}>Reset</button>
      <label className="pv-slider"><span className="sr-only">Go to step</span>
        <input type="range" min={1} max={last + 1} value={Math.min(frame, last) + 1} onChange={event => { setPlaying(false); setFrame(Number(event.target.value) - 1) }} aria-valuetext={`Step ${Math.min(frame, last) + 1} of ${last + 1}`} />
      </label>
    </div>
    <div className="pv-columns">
      <div className="pv-code">
        <div className="segmented" role="radiogroup" aria-label="Code language">
          {(['py', 'js'] as const).map(item => <label key={item} className="chip"><input type="radio" name={`${uid}-lang`} checked={lang === item} onChange={() => setLang(item)} />{LANG_LABEL[item]}</label>)}
        </div>
        <label htmlFor={`${uid}-code`} className="sr-only">{LANG_LABEL[lang]} code for {spec.function[lang]}</label>
        <Editor id={`${uid}-code`} lang={lang} value={shown.code} onChange={() => {}} readOnly activeLine={shown.lines[current.line]} interview />
      </div>
      <div className="pv-vars">
        <h3>Variables</h3>
        <dl>
          {Object.entries(current.vars).map(([name, value]) => <div key={name}><dt><code>{name}</code></dt><dd>{show(value)}</dd></div>)}
          {frame >= last && <div><dt>Result</dt><dd><code>{JSON.stringify(trace.result)}</code></dd></div>}
        </dl>
      </div>
    </div>
    <form className="pv-input" onSubmit={event => { event.preventDefault(); load(inputs) }} noValidate>
      <h3>Your own input</h3>
      <p id={`${uid}-help`} className="helper">{spec.inputHelp}</p>
      <div className="pv-fields">
        {tracer.params.map(param => {
          const error = errors[param.name]
          const id = `${uid}-${param.name}`
          return <div key={param.name} className="field">
            <label htmlFor={id}>{param.label}</label>
            <input id={id} type="text" inputMode={param.kind === 'int' ? 'numeric' : 'text'} autoComplete="off" spellCheck={false} value={inputs[param.name] ?? ''}
              onChange={event => setInputs(value => ({ ...value, [param.name]: event.target.value }))}
              aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error ${uid}-help` : `${uid}-help`} />
            {error && <p id={`${id}-error`} className="field-error">{error}</p>}
          </div>
        })}
      </div>
      <button type="submit">Visualise my input</button>
    </form>
    <details className="pv-all">
      <summary>Show all steps as text</summary>
      <ol>{trace.frames.map((item, index) => <li key={index} aria-current={index === frame ? 'step' : undefined}>{item.text}</li>)}</ol>
    </details>
  </div>
}
