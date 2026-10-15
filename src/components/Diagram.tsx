import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { BarsDiagram, ChartDiagram, CompareDiagram, Diagram, EdgeStyle, FlowBody, FlowDiagram, FlowNode, SequenceDiagram, TimelineDiagram } from '../guide-types'
import {
  BAR_LABEL_W, CHART_H, CHART_W, KIND_TAG, PLOT, chartLabel, chartPoint, describeDiagram, diagramSteps, formatValue,
  layoutBars, layoutFlow, layoutSequence, layoutTimeline, sequenceLabel, SEQ_TOP,
} from '../diagram-layout'
import Icon from './Icon'
import '../diagram.css'

const STYLES: EdgeStyle[] = ['sync', 'async', 'reply', 'fail']
const reducedQuery = '(prefers-reduced-motion: reduce)'
function subscribe(notify: () => void) {
  const media = window.matchMedia(reducedQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(reducedQuery).matches, () => false)
}

/** Arrowheads, one per edge style plus the highlighted state. Markers take colour from CSS classes. */
function Markers({ uid }: { uid: string }) {
  return <defs>
    {[...STYLES, 'active'].map(style => <marker key={style} id={`${uid}-${style}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" className={`dg-head dg-head-${style}`} />
    </marker>)}
  </defs>
}

function NodeShape({ node, x, y, w, h }: { node: FlowNode; x: number; y: number; w: number; h: number }) {
  const rx = node.kind === 'state' ? h / 2 : node.kind === 'decision' ? 2 : 8
  return <>
    <rect x={x} y={y} width={w} height={h} rx={rx} className="dg-box" />
    {node.kind === 'db' && <path d={`M${x} ${y + 10} Q${x + w / 2} ${y + 20} ${x + w} ${y + 10}`} className="dg-detail" />}
    {node.kind === 'queue' && [0, 1, 2].map(i => <line key={i} x1={x + w - 8 - i * 6} x2={x + w - 8 - i * 6} y1={y + 8} y2={y + h - 8} className="dg-detail" />)}
    {node.kind === 'cache' && <path d={`M${x + w - 14} ${y + 6} l-5 10 h6 l-5 10`} className="dg-detail" />}
  </>
}

/** Diagrams scroll sideways rather than shrink text below ~85% on phones, and stop growing past 125% on wide screens. */
const MIN_SCALE = 0.85
const MAX_SCALE = 1.25

function FlowSvg({ body, label, steps, step, reduced, minWidth = MIN_SCALE }: { body: FlowBody; label: string; steps?: FlowDiagram['steps']; step: number; reduced: boolean; minWidth?: number }) {
  const uid = useId().replace(/:/g, '')
  const layout = layoutFlow(body)
  const active = new Set(step >= 0 && steps ? steps[step].edges : [])
  const activeNodes = new Set(body.edges.filter((_, i) => active.has(i)).flatMap(edge => [edge.from, edge.to]))
  return <>
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="dg-svg" style={{ minWidth: Math.round(layout.width * minWidth), maxWidth: Math.round(layout.width * MAX_SCALE) }} role="img" aria-label={label}>
      <Markers uid={uid} />
      <rect width={layout.width} height={layout.height} rx="10" className="dg-bg" />
      {body.edges.map((edge, i) => {
        const geo = layout.edges[i]
        const state = step < 0 || !steps ? '' : active.has(i) ? ' is-active' : ' is-dim'
        const style = edge.style ?? 'sync'
        return <g key={i} className={`dg-edge dg-${style}${state}`}>
          <path d={geo.d} className="dg-line" markerEnd={`url(#${uid}-${state === ' is-active' ? 'active' : style})`} />
          {state === ' is-active' && !reduced && <circle r="4.5" className="dg-packet"><animateMotion dur="1.4s" repeatCount="indefinite" path={geo.d} /></circle>}
        </g>
      })}
      {body.nodes.map(node => {
        const box = layout.boxes.get(node.id)!
        const tag = KIND_TAG[node.kind]
        const labelY = box.y + (tag ? (node.sub ? 32 : 36) : (node.sub ? 25 : 32))
        return <g key={node.id} className={`dg-node dg-k-${node.kind}${activeNodes.has(node.id) ? ' is-active' : ''}`}>
          <NodeShape node={node} x={box.x} y={box.y} w={box.w} h={box.h} />
          {tag && <text x={box.cx} y={box.y + 15} className="dg-tag" textAnchor="middle">{tag}</text>}
          <text x={box.cx} y={labelY} className="dg-label" textAnchor="middle">{node.label}</text>
          {node.sub && <text x={box.cx} y={labelY + 15} className="dg-sub" textAnchor="middle">{node.sub}</text>}
        </g>
      })}
      {body.edges.map((edge, i) => {
        const placed = layout.edges[i].label
        if (!placed || !edge.label) return null
        return placed.badge
          ? <g key={i} className="dg-badge"><circle cx={placed.x} cy={placed.y} r="10" /><text x={placed.x} y={placed.y + 4} textAnchor="middle">{placed.badge}</text></g>
          : <text key={i} x={placed.x} y={placed.y} textAnchor={placed.anchor} className="dg-edge-label">{edge.label}</text>
      })}
    </svg>
    {layout.legend.length > 0 && <ol className="dg-legend" aria-label="Arrow labels">{layout.legend.map(item => <li key={item.badge}><span className="dg-legend-badge" aria-hidden="true">{item.badge}</span>{item.text}</li>)}</ol>}
  </>
}

function SequenceSvg({ diagram, step, reduced }: { diagram: SequenceDiagram; step: number; reduced: boolean }) {
  const uid = useId().replace(/:/g, '')
  const layout = layoutSequence(diagram)
  return <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="dg-svg" style={{ minWidth: Math.round(layout.width * MIN_SCALE), maxWidth: Math.round(layout.width * MAX_SCALE) }} role="img" aria-label={diagram.title}>
    <Markers uid={uid} />
    <rect width={layout.width} height={layout.height} rx="10" className="dg-bg" />
    {diagram.actors.map(actor => {
      const x = layout.x.get(actor.id)!
      return <g key={actor.id} className="dg-actor">
        <line x1={x} x2={x} y1={SEQ_TOP - 12} y2={layout.height - 10} className="dg-lifeline" />
        <rect x={x - 66} y={10} width={132} height={34} rx="8" className="dg-box" />
        <text x={x} y={32} textAnchor="middle" className="dg-label">{actor.label}</text>
      </g>
    })}
    {diagram.messages.map((message, i) => {
      const geo = layout.messages[i]
      const state = step < 0 ? '' : i === step ? ' is-active' : i > step ? ' is-dim' : ''
      const style = message.style ?? 'sync'
      const d = `M${geo.x1} ${geo.y} L${geo.x2} ${geo.y}`
      return <g key={i} className={`dg-edge dg-${style}${state}`}>
        <path d={d} className="dg-line" markerEnd={`url(#${uid}-${state === ' is-active' ? 'active' : style})`} />
        {state === ' is-active' && !reduced && <circle r="4.5" className="dg-packet"><animateMotion dur="1.2s" repeatCount="indefinite" path={d} /></circle>}
        <text x={geo.labelX} y={geo.labelY} textAnchor="middle" className="dg-edge-label">{sequenceLabel(message.label, i)}</text>
      </g>
    })}
  </svg>
}

function CompareView({ diagram }: { diagram: CompareDiagram }) {
  return <div className="dg-compare">
    {(['before', 'after'] as const).map(side => <div key={side} className={`dg-panel dg-panel-${side}`}>
      <p className="dg-panel-label"><Icon name={side === 'before' ? 'x' : 'check'} size={16} />{side === 'before' ? 'Before' : 'After'}: {diagram[side].label}</p>
      <div className="dg-scroll" tabIndex={0} role="region" aria-label={`${side === 'before' ? 'Before' : 'After'}: ${diagram[side].label}`}>
        <FlowSvg body={diagram[side]} label={`${side === 'before' ? 'Before' : 'After'}: ${diagram[side].label}`} step={-1} reduced minWidth={0.8} />
      </div>
    </div>)}
  </div>
}

function ChartSvg({ diagram }: { diagram: ChartDiagram }) {
  const ticks = [0, 5, 10]
  return <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="dg-svg" style={{ minWidth: Math.round(CHART_W * 0.8), maxWidth: Math.round(CHART_W * MAX_SCALE) }} role="img" aria-label={diagram.title}>
    <rect width={CHART_W} height={CHART_H} rx="10" className="dg-bg" />
    {ticks.map(t => <g key={t} className="dg-grid">
      <line x1={chartPoint(t, 0).x} x2={chartPoint(t, 10).x} y1={PLOT.bottom} y2={PLOT.top} />
      <line x1={PLOT.left} x2={PLOT.right} y1={chartPoint(0, t).y} y2={chartPoint(0, t).y} />
    </g>)}
    <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} className="dg-axis" />
    <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.bottom} y2={PLOT.top} className="dg-axis" />
    <text x={PLOT.left} y={PLOT.bottom + 20} className="dg-sub">{diagram.x.low}</text>
    <text x={PLOT.right} y={PLOT.bottom + 20} textAnchor="end" className="dg-sub">{diagram.x.high}</text>
    <text x={(PLOT.left + PLOT.right) / 2} y={CHART_H - 14} textAnchor="middle" className="dg-axis-label">{diagram.x.label} →</text>
    <text transform={`translate(44 ${PLOT.bottom}) rotate(-90)`} className="dg-sub">{diagram.y.low}</text>
    <text transform={`translate(44 ${PLOT.top}) rotate(-90)`} textAnchor="end" className="dg-sub">{diagram.y.high}</text>
    <text transform={`translate(20 ${(PLOT.top + PLOT.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="dg-axis-label">{diagram.y.label} →</text>
    {diagram.points.map(point => {
      const at = chartPoint(point.x, point.y)
      const label = chartLabel(point)
      return <g key={point.label} className={`dg-point${point.highlight ? ' is-highlight' : ''}`}>
        <circle cx={at.x} cy={at.y} r="7" />
        <text x={at.x + label.dx} y={at.y + 4} textAnchor={label.anchor} className="dg-point-label">{point.label}</text>
      </g>
    })}
  </svg>
}

function BarsSvg({ diagram }: { diagram: BarsDiagram }) {
  const layout = layoutBars(diagram)
  return <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="dg-svg" style={{ minWidth: Math.round(layout.width * 0.8), maxWidth: Math.round(layout.width * MAX_SCALE) }} role="img" aria-label={diagram.title}>
    <rect width={layout.width} height={layout.height} rx="10" className="dg-bg" />
    {diagram.bars.map((bar, i) => {
      const geo = layout.bars[i]
      return <g key={bar.label} className={`dg-bar${bar.highlight ? ' is-highlight' : ''}`}>
        <text x={BAR_LABEL_W - 10} y={geo.y + 16} textAnchor="end" className="dg-label">{bar.label}</text>
        <rect x={BAR_LABEL_W} y={geo.y + 2} width={geo.w} height={20} rx="4" />
        <text x={BAR_LABEL_W + geo.w + 8} y={geo.y + 16} className="dg-sub">{formatValue(bar.value)} {diagram.unit}</text>
      </g>
    })}
  </svg>
}

function TimelineSvg({ diagram }: { diagram: TimelineDiagram }) {
  const layout = layoutTimeline(diagram)
  return <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="dg-svg" style={{ minWidth: Math.round(layout.width * 0.8), maxWidth: Math.round(layout.width * MAX_SCALE) }} role="img" aria-label={diagram.title}>
    <rect width={layout.width} height={layout.height} rx="10" className="dg-bg" />
    <line x1="170" x2="170" y1="14" y2={layout.height - 14} className="dg-axis" />
    {diagram.events.map((event, i) => {
      const geo = layout.events[i]
      return <g key={i} className={`dg-event dg-ev-${event.kind}`}>
        <text x="156" y={geo.top + 14} textAnchor="end" className="dg-label">{event.at}</text>
        <circle cx="170" cy={geo.top + 10} r="7" />
        <text x="186" y={geo.top + 14} className="dg-tag">{event.kind.toUpperCase()}</text>
        {geo.lines.map((line, j) => <text key={j} x="186" y={geo.top + 32 + j * 17} className="dg-text">{line}</text>)}
      </g>
    })}
  </svg>
}

/** A numbered, captioned, accessible figure. Request flows and sequences get a step-through. */
export default function DiagramFigure({ diagram, number }: { diagram: Diagram; number: number }) {
  const reduced = useReducedMotion()
  const steps = diagramSteps(diagram)
  const [step, setStep] = useState(-1)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing || reduced) return
    const timer = window.setTimeout(() => {
      if (step >= steps.length - 1) setPlaying(false)
      else setStep(step + 1)
    }, step < 0 ? 0 : 2600)
    return () => window.clearTimeout(timer)
  }, [playing, reduced, step, steps.length])
  useEffect(() => { if (reduced) setPlaying(false) }, [reduced])
  const name = `Figure ${number}: ${diagram.title}`
  let body: ReactNode
  switch (diagram.type) {
    case 'flow': body = <FlowSvg body={diagram} label={diagram.title} steps={diagram.steps} step={step} reduced={reduced} />; break
    case 'sequence': body = <SequenceSvg diagram={diagram} step={step} reduced={reduced} />; break
    case 'chart': body = <ChartSvg diagram={diagram} />; break
    case 'bars': body = <BarsSvg diagram={diagram} />; break
    case 'timeline': body = <TimelineSvg diagram={diagram} />; break
    case 'compare': body = null
  }
  return <figure className={`dg-figure dg-type-${diagram.type}`} id={`fig-${diagram.id}`} aria-label={name}>
    <p className="dg-title"><span className="dg-number">Figure {number}</span> {diagram.title}</p>
    <p className="sr-only">{diagram.alt}</p>
    {diagram.type === 'compare' ? <CompareView diagram={diagram} /> : <div className="dg-scroll" tabIndex={0} role="region" aria-label={`${name}. Scroll sideways on narrow screens.`}>{body}</div>}
    {steps.length > 0 && <div className="dg-steps">
      <div className="dg-step-buttons">
        <button type="button" onClick={() => { setPlaying(false); setStep(Math.max(0, step - 1)) }} disabled={step <= 0}><Icon name="back" size={16} />Previous</button>
        <button type="button" onClick={() => { setPlaying(false); setStep(Math.min(steps.length - 1, step + 1)) }} disabled={step >= steps.length - 1}>{step < 0 ? 'Step through' : 'Next'}<Icon name="arrow" size={16} /></button>
        {!reduced && <button type="button" aria-pressed={playing} onClick={() => { if (playing) setPlaying(false); else { if (step >= steps.length - 1) setStep(-1); setPlaying(true) } }}>{playing ? 'Pause' : 'Play'}</button>}
        {step >= 0 && <button type="button" onClick={() => { setPlaying(false); setStep(-1) }}>Show all</button>}
      </div>
      <p className="dg-step-text" aria-live="polite">{step >= 0 ? <><strong>Step {step + 1} of {steps.length}.</strong> {steps[step]}</> : `${steps.length} steps. Step through to follow the request.`}</p>
    </div>}
    <figcaption>{diagram.caption}</figcaption>
    <details className="dg-description">
      <summary>Text description</summary>
      <p>{diagram.alt}</p>
      <ul>{describeDiagram(diagram).map((line, i) => <li key={i}>{line}</li>)}</ul>
    </details>
  </figure>
}
