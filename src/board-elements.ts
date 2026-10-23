/** Plain builders for Excalidraw scene elements, so stencils and migrations need no Excalidraw import. */

export interface SceneElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  isDeleted: boolean
  groupIds: string[]
  boundElements: { id: string; type: 'arrow' | 'text' }[] | null
  [key: string]: unknown
}

export type ShapeType = 'rectangle' | 'ellipse' | 'diamond'

export interface ShapeStyle {
  stroke?: string
  fill?: string
  dashed?: boolean
  rounded?: boolean
}

const FONT_SIZE = 16
const LINE_HEIGHT = 1.25
/** Excalifont, the default hand-drawn font. */
const FONT_FAMILY = 5

/** A stable 31-bit number from a string, so generated scenes are deterministic. */
export function seedFrom(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return (hash >>> 1) || 1
}

function base(type: string, id: string, x: number, y: number, width: number, height: number, groupIds: string[], style: ShapeStyle = {}): SceneElement {
  return {
    id, type, x, y, width, height, angle: 0,
    strokeColor: style.stroke ?? '#1e1e1e', backgroundColor: style.fill ?? 'transparent', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: style.dashed ? 'dashed' : 'solid', roughness: 1, opacity: 100,
    groupIds, frameId: null, roundness: style.rounded ? { type: type === 'rectangle' ? 3 : 2 } : null,
    seed: seedFrom(id), version: 1, versionNonce: seedFrom(`${id}:nonce`), index: null, isDeleted: false,
    boundElements: null, updated: 1, link: null, locked: false,
  }
}

function textSize(text: string) {
  const lines = text.split('\n')
  return { width: Math.ceil(Math.max(...lines.map(line => line.length)) * FONT_SIZE * 0.6), height: Math.ceil(lines.length * FONT_SIZE * LINE_HEIGHT) }
}

function label(id: string, text: string, containerId: string, centre: { x: number; y: number }, groupIds: string[], stroke: string): SceneElement {
  const size = textSize(text)
  return {
    ...base('text', id, centre.x - size.width / 2, centre.y - size.height / 2, size.width, size.height, groupIds, { stroke }),
    text, originalText: text, fontSize: FONT_SIZE, fontFamily: FONT_FAMILY, textAlign: 'center', verticalAlign: 'middle',
    containerId, autoResize: true, lineHeight: LINE_HEIGHT,
  }
}

/** A shape with a centred label bound to it: returns [shape, text]. */
export function labelledShape(options: { id: string; type: ShapeType; x: number; y: number; width: number; height: number; text: string; groupIds?: string[]; style?: ShapeStyle }): SceneElement[] {
  const { id, type, x, y, width, height, text, groupIds = [], style = {} } = options
  const textId = `${id}-label`
  const shape = { ...base(type, id, x, y, width, height, groupIds, style), boundElements: [{ id: textId, type: 'text' as const }] }
  return [shape, label(textId, text, id, { x: x + width / 2, y: y + height / 2 }, groupIds, style.stroke ?? '#1e1e1e')]
}

/** Point where the line from a shape's centre towards (dx, dy) leaves its box. */
function edgePoint(shape: SceneElement, dx: number, dy: number) {
  const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2
  if (!dx && !dy) return { x: cx, y: cy }
  const t = Math.min(dx ? (shape.width / 2) / Math.abs(dx) : Infinity, dy ? (shape.height / 2) / Math.abs(dy) : Infinity)
  return { x: cx + dx * t, y: cy + dy * t }
}

const GAP = 6

/** An arrow bound to two shapes, with an optional label. Adds the bindings to both shapes. Returns [arrow, text?]. */
export function boundArrow(id: string, from: SceneElement, to: SceneElement, text?: string): SceneElement[] {
  const dx = (to.x + to.width / 2) - (from.x + from.width / 2)
  const dy = (to.y + to.height / 2) - (from.y + from.height / 2)
  const length = Math.hypot(dx, dy) || 1
  const start = edgePoint(from, dx, dy), end = edgePoint(to, -dx, -dy)
  const sx = start.x + dx / length * GAP, sy = start.y + dy / length * GAP
  const ex = end.x - dx / length * GAP, ey = end.y - dy / length * GAP
  const textId = text ? `${id}-label` : undefined
  const arrow: SceneElement = {
    ...base('arrow', id, sx, sy, Math.abs(ex - sx), Math.abs(ey - sy), []),
    roundness: { type: 2 },
    points: [[0, 0], [ex - sx, ey - sy]], lastCommittedPoint: null,
    startBinding: { elementId: from.id, focus: 0, gap: GAP }, endBinding: { elementId: to.id, focus: 0, gap: GAP },
    startArrowhead: null, endArrowhead: 'arrow', elbowed: false,
    boundElements: textId ? [{ id: textId, type: 'text' }] : null,
  }
  for (const shape of [from, to]) shape.boundElements = [...shape.boundElements ?? [], { id, type: 'arrow' }]
  return textId ? [arrow, label(textId, text!, id, { x: (sx + ex) / 2, y: (sy + ey) / 2 }, [], '#1e1e1e')] : [arrow]
}

/** Checks the fields every element needs and that bindings point at real elements. Returns problems found. */
export function elementProblems(elements: readonly SceneElement[]): string[] {
  const problems: string[] = []
  const ids = new Map(elements.map(element => [element.id, element]))
  if (ids.size !== elements.length) problems.push('duplicate element ids')
  for (const element of elements) {
    for (const key of ['x', 'y', 'width', 'height', 'seed', 'version', 'versionNonce']) {
      if (typeof element[key] !== 'number' || !Number.isFinite(element[key])) problems.push(`${element.id}: ${key} is not a number`)
    }
    if (!Array.isArray(element.groupIds)) problems.push(`${element.id}: groupIds missing`)
    for (const bound of element.boundElements ?? []) if (!ids.has(bound.id)) problems.push(`${element.id}: bound element ${bound.id} missing`)
    if (element.type === 'text') {
      if (typeof element.text !== 'string' || !element.text) problems.push(`${element.id}: empty text`)
      const container = typeof element.containerId === 'string' ? ids.get(element.containerId) : undefined
      if (element.containerId !== null && !container?.boundElements?.some(item => item.id === element.id)) problems.push(`${element.id}: container not bound`)
    }
    if (element.type === 'arrow') {
      for (const key of ['startBinding', 'endBinding']) {
        const binding = element[key] as { elementId: string } | null
        if (binding && !ids.get(binding.elementId)?.boundElements?.some(item => item.id === element.id)) problems.push(`${element.id}: ${key} not bound`)
      }
    }
  }
  return problems
}
