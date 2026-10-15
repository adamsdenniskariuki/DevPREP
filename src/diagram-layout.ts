import type { BarsDiagram, ChartDiagram, Diagram, EdgeStyle, FlowBody, FlowNode, FlowNodeKind, SequenceDiagram, TimelineDiagram } from './guide-types'

// Pure geometry and text for src/components/Diagram.tsx, kept separate so tests can check
// that every shipped diagram lays out without overlaps and reads well as text.

export const CELL_W = 150
export const CELL_H = 92
export const NODE_W = 128
export const NODE_H = 56
export const PAD = 14

export const KIND_TAG: Record<FlowNodeKind, string> = {
  client: 'CLIENT', service: 'SERVICE', worker: 'WORKER', cache: 'CACHE', db: 'DATABASE', queue: 'QUEUE', storage: 'STORAGE',
  external: 'EXTERNAL', lb: 'LOAD BALANCER', cdn: 'CDN', note: '', state: '', decision: 'CHECK', bad: 'AVOID', good: 'BETTER',
}

export interface Box { x: number; y: number; w: number; h: number; cx: number; cy: number }
export interface EdgeLabel { x: number; y: number; anchor: 'middle' | 'start'; badge?: number }
export interface FlowLayout {
  width: number
  height: number
  boxes: Map<string, Box>
  edges: { d: string; mid: { x: number; y: number }; start: { x: number; y: number }; end: { x: number; y: number }; label?: EdgeLabel }[]
  /** Labels too long for the space on their edge, shown as numbered badges with a legend. */
  legend: { badge: number; text: string }[]
}
const LABEL_SIZE = 11
const LABEL_H = 16
interface Rect { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect, m = 2) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m

/** Does the segment p→q pass through the rectangle? (Liang–Barsky clip.) */
export function segmentHitsRect(p: { x: number; y: number }, q: { x: number; y: number }, box: Rect) {
  let t0 = 0, t1 = 1
  const dx = q.x - p.x, dy = q.y - p.y
  const tests: [number, number][] = [[-dx, p.x - box.x], [dx, box.x + box.w - p.x], [-dy, p.y - box.y], [dy, box.y + box.h - p.y]]
  for (const [pp, qq] of tests) {
    if (pp === 0) { if (qq < 0) return false; continue }
    const t = qq / pp
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t }
    else { if (t < t0) return false; if (t < t1) t1 = t }
  }
  return t1 - t0 > 0.02
}

/** Edges whose straight line runs through a node that is not one of its ends. Content tests require none. */
export function edgeCrossings(body: FlowBody): string[] {
  const layout = layoutFlow(body)
  const out: string[] = []
  body.edges.forEach((edge, i) => {
    const { start, end } = layout.edges[i]
    for (const node of body.nodes) {
      if (node.id === edge.from || node.id === edge.to) continue
      if (segmentHitsRect(start, end, layout.boxes.get(node.id)!)) out.push(`${edge.from}->${edge.to} crosses ${node.id}`)
    }
  })
  return out
}

/** Point where the ray from the box centre toward (tx, ty) leaves the box. */
function exit(box: Box, tx: number, ty: number, gap = 3) {
  const dx = tx - box.cx, dy = ty - box.cy
  if (!dx && !dy) return { x: box.cx, y: box.cy }
  const sx = dx ? (box.w / 2 + gap) / Math.abs(dx) : Infinity
  const sy = dy ? (box.h / 2 + gap) / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: box.cx + dx * s, y: box.cy + dy * s }
}

export function layoutFlow(body: FlowBody): FlowLayout {
  const cols = Math.max(...body.nodes.map(node => node.col)) + 1
  const rows = Math.max(...body.nodes.map(node => node.row)) + 1
  const width = PAD * 2 + cols * CELL_W
  const height = PAD * 2 + rows * CELL_H - (CELL_H - NODE_H) + 8
  const boxes = new Map<string, Box>()
  for (const node of body.nodes) {
    const x = PAD + node.col * CELL_W + (CELL_W - NODE_W) / 2
    const y = PAD + node.row * CELL_H + 4
    boxes.set(node.id, { x, y, w: NODE_W, h: NODE_H, cx: x + NODE_W / 2, cy: y + NODE_H / 2 })
  }
  const pairs = new Set(body.edges.map(edge => `${edge.from}>${edge.to}`))
  const edges = body.edges.map(edge => {
    const a = boxes.get(edge.from)!, b = boxes.get(edge.to)!
    // Two edges in opposite directions between the same nodes sit side by side.
    const twin = pairs.has(`${edge.to}>${edge.from}`)
    const len = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1
    const ox = twin ? -(b.cy - a.cy) / len * 7 : 0
    const oy = twin ? (b.cx - a.cx) / len * 7 : 0
    const start = exit({ ...a, cx: a.cx + ox, cy: a.cy + oy }, b.cx + ox, b.cy + oy)
    const end = exit({ ...b, cx: b.cx + ox, cy: b.cy + oy }, a.cx + ox, a.cy + oy, 6)
    return { d: `M${r(start.x)} ${r(start.y)} L${r(end.x)} ${r(end.y)}`, mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, start, end }
  })
  // Place each label on its edge if it clears every node and earlier label; otherwise use a badge.
  const taken: Rect[] = [...boxes.values()]
  const legend: FlowLayout['legend'] = []
  const placed = edges.map((edge, i) => {
    const text = body.edges[i].label
    if (!text) return edge
    const w = textWidth(text, LABEL_SIZE) + 8
    const vertical = Math.abs(edge.end.x - edge.start.x) < 1
    const candidates: (EdgeLabel & { rect: Rect })[] = vertical
      ? [{ x: edge.mid.x + 6, y: edge.mid.y + 4, anchor: 'start', rect: { x: edge.mid.x + 2, y: edge.mid.y - LABEL_H / 2, w, h: LABEL_H } }]
      : [{ x: edge.mid.x, y: edge.mid.y + 4, anchor: 'middle', rect: { x: edge.mid.x - w / 2, y: edge.mid.y - LABEL_H / 2, w, h: LABEL_H } }]
    const fit = candidates.find(c => c.rect.x >= 0 && c.rect.x + c.rect.w <= width && !taken.some(t => overlaps(c.rect, t)))
    if (fit) {
      taken.push(fit.rect)
      return { ...edge, label: { x: fit.x, y: fit.y, anchor: fit.anchor } }
    }
    const badge = legend.length + 1
    legend.push({ badge, text })
    taken.push({ x: edge.mid.x - 10, y: edge.mid.y - 10, w: 20, h: 20 })
    return { ...edge, label: { x: edge.mid.x, y: edge.mid.y, anchor: 'middle' as const, badge } }
  })
  return { width, height, boxes, edges: placed, legend }
}

const r = (n: number) => Math.round(n * 10) / 10

/** Rough text width in px for the diagram font at the given size. Errs wide. */
export function textWidth(text: string, size: number) { return text.length * size * 0.56 }

export const sequenceLabel = (label: string, i: number) => `${i + 1}. ${label}`
export const SEQ_COL = 168
export const SEQ_ROW = 46
export const SEQ_TOP = 58
export function layoutSequence(diagram: SequenceDiagram) {
  const width = PAD * 2 + diagram.actors.length * SEQ_COL
  const x = new Map(diagram.actors.map((actor, i) => [actor.id, PAD + i * SEQ_COL + SEQ_COL / 2]))
  const height = SEQ_TOP + diagram.messages.length * SEQ_ROW + 20
  const messages = diagram.messages.map((message, i) => {
    const x1 = x.get(message.from)!, x2 = x.get(message.to)!
    const y = SEQ_TOP + 26 + i * SEQ_ROW
    const half = textWidth(sequenceLabel(message.label, i), 12) / 2
    const labelX = Math.min(width - PAD - half, Math.max(PAD + half, (x1 + x2) / 2))
    const end = x2 + (x2 > x1 ? -4 : 4)
    return { x1, x2: end, y, labelX, labelY: y - 8 }
  })
  return { width, height, x, messages }
}

export const CHART_W = 560
export const CHART_H = 380
export const PLOT = { left: 64, right: 540, top: 18, bottom: 318 }
export function chartPoint(x: number, y: number) {
  return { x: PLOT.left + x / 10 * (PLOT.right - PLOT.left), y: PLOT.bottom - y / 10 * (PLOT.bottom - PLOT.top) }
}
export function chartLabel(point: { x: number; label: string }) {
  const at = chartPoint(point.x, 0).x
  const right = at + 12 + textWidth(point.label, 12) <= CHART_W - 6
  return { anchor: right ? 'start' as const : 'end' as const, dx: right ? 12 : -12 }
}

/** Pairs of chart points whose labels would collide. Content tests require none. */
export function chartOverlaps(diagram: ChartDiagram): string[] {
  const rects = diagram.points.map(point => {
    const at = chartPoint(point.x, point.y)
    const label = chartLabel(point)
    const w = textWidth(point.label, 12)
    const x = label.anchor === 'start' ? at.x + label.dx : at.x + label.dx - w
    return { x: Math.min(x, at.x - 8), y: at.y - 9, w: w + Math.abs(label.dx) + 8, h: 18 }
  })
  const out: string[] = []
  rects.forEach((a, i) => rects.slice(i + 1).forEach((b, j) => { if (overlaps(a, b, 0)) out.push(`${diagram.points[i].label} / ${diagram.points[i + j + 1].label}`) }))
  return out
}

export const BAR_LABEL_W = 168
export const BAR_W = 560
export const BAR_ROW = 38
export function layoutBars(diagram: BarsDiagram) {
  const max = Math.max(...diagram.bars.map(bar => bar.value))
  const area = BAR_W - BAR_LABEL_W - 110
  return {
    width: BAR_W,
    height: diagram.bars.length * BAR_ROW + 16,
    bars: diagram.bars.map((bar, i) => ({ y: 10 + i * BAR_ROW, w: Math.max(3, bar.value / max * area) })),
  }
}

/** Greedy word wrap for SVG text, which has no automatic wrapping. */
export function wrap(text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) { lines.push(line); line = word }
    else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

export const TIMELINE_W = 560
export const TIMELINE_WRAP = 50
export function layoutTimeline(diagram: TimelineDiagram) {
  let y = 14
  const events = diagram.events.map(event => {
    const lines = wrap(event.label, TIMELINE_WRAP)
    const top = y
    y += 26 + lines.length * 17 + 12
    return { top, lines }
  })
  return { width: TIMELINE_W, height: y, events }
}

const ARROW: Record<EdgeStyle, string> = { sync: 'calls', async: 'sends asynchronously to', reply: 'replies to', fail: 'fails to reach' }
const nodeName = (node: FlowNode) => `${node.label}${node.sub ? ` (${node.sub})` : ''}`

function describeBody(body: FlowBody): string[] {
  const byId = new Map(body.nodes.map(node => [node.id, node]))
  return [
    `Parts: ${body.nodes.map(nodeName).join('; ')}.`,
    ...body.edges.map(edge => `${byId.get(edge.from)!.label} ${ARROW[edge.style ?? 'sync']} ${byId.get(edge.to)!.label}${edge.label ? `: ${edge.label}` : ''}.`),
  ]
}

/** A complete text equivalent of a diagram, shown under it in a disclosure. */
export function describeDiagram(diagram: Diagram): string[] {
  switch (diagram.type) {
    case 'flow': return describeBody(diagram)
    case 'compare': return [`${diagram.before.label}:`, ...describeBody(diagram.before), `${diagram.after.label}:`, ...describeBody(diagram.after)]
    case 'sequence': {
      const name = new Map(diagram.actors.map(actor => [actor.id, actor.label]))
      return diagram.messages.map((message, i) => `${i + 1}. ${name.get(message.from)} ${ARROW[message.style ?? 'sync']} ${name.get(message.to)}: ${message.label}.${message.note ? ` ${message.note}` : ''}`)
    }
    case 'chart': return [
      `Horizontal axis: ${diagram.x.label}, from ${diagram.x.low} to ${diagram.x.high}. Vertical axis: ${diagram.y.label}, from ${diagram.y.low} to ${diagram.y.high}.`,
      ...diagram.points.map(point => `${point.label}: ${diagram.x.label} ${point.x} of 10, ${diagram.y.label} ${point.y} of 10${point.highlight ? ' (highlighted)' : ''}.`),
    ]
    case 'bars': return diagram.bars.map(bar => `${bar.label}: ${formatValue(bar.value)} ${diagram.unit}${bar.highlight ? ' (highlighted)' : ''}.`)
    case 'timeline': return diagram.events.map(event => `${event.at} (${event.kind}): ${event.label}`)
  }
}

export function formatValue(value: number) {
  return value >= 1000 ? value.toLocaleString('en-US') : String(value)
}

/** The steps a step-through walks: flow steps, or one per sequence message. Empty when the diagram has none. */
export function diagramSteps(diagram: Diagram): string[] {
  if (diagram.type === 'flow') return diagram.steps?.map(step => step.text) ?? []
  if (diagram.type === 'sequence') {
    const name = new Map(diagram.actors.map(actor => [actor.id, actor.label]))
    return diagram.messages.map(message => `${name.get(message.from)} → ${name.get(message.to)}: ${message.label}.${message.note ? ` ${message.note}` : ''}`)
  }
  return []
}

export type { ChartDiagram }
