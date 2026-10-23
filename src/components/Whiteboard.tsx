import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { NODE_KIND_LABELS, NODE_KINDS } from '../case-types'
import type { DiagramEdge, DiagramNode, NodeKind } from '../case-types'
import { BOARD_HEIGHT, BOARD_WIDTH, emptyBoard, MAX_EDGES, MAX_LABEL, MAX_NODES, NODE_HEIGHT, NODE_WIDTH } from '../design-drafts'
import type { Board, BoardNode } from '../design-drafts'

const GRID = 8
const COL_STEP = 168
const ROW_STEP = 104
const MARGIN = 24

/** Lays out a model diagram's grid cells on the same canvas the learner draws on. */
export function modelBoard(diagram: { nodes: DiagramNode[]; edges: DiagramEdge[] }): Board {
  return {
    nodes: diagram.nodes.map(node => ({ id: node.id, kind: node.kind, label: node.label, x: MARGIN + node.col * COL_STEP, y: MARGIN + node.row * ROW_STEP })),
    edges: diagram.edges.map(edge => ({ ...edge })),
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const snap = (value: number) => Math.round(value / GRID) * GRID
const shortLabel = (label: string) => label.length > 19 ? `${label.slice(0, 18)}…` : label || 'Untitled'

/** Point where the line from a node's centre towards (dx, dy) leaves its rectangle. */
function border(node: BoardNode, dx: number, dy: number) {
  const cx = node.x + NODE_WIDTH / 2, cy = node.y + NODE_HEIGHT / 2
  if (!dx && !dy) return { x: cx, y: cy }
  const t = Math.min(dx ? (NODE_WIDTH / 2) / Math.abs(dx) : Infinity, dy ? (NODE_HEIGHT / 2) / Math.abs(dy) : Infinity)
  return { x: cx + dx * t, y: cy + dy * t }
}

function freeSlot(board: Board) {
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
    const x = MARGIN + col * COL_STEP, y = MARGIN + row * ROW_STEP
    if (!board.nodes.some(node => Math.abs(node.x - x) < NODE_WIDTH && Math.abs(node.y - y) < NODE_HEIGHT)) return { x, y }
  }
  return { x: MARGIN + (board.nodes.length % 10) * GRID, y: MARGIN + (board.nodes.length % 10) * GRID }
}

export function describeBoard(board: Board): string[] {
  const name = (id: string) => board.nodes.find(node => node.id === id)?.label || 'Untitled'
  return [
    ...board.nodes.map(node => `${node.label || 'Untitled'} (${NODE_KIND_LABELS[node.kind]})`),
    ...board.edges.map(edge => `${name(edge.from)} → ${name(edge.to)}${edge.label ? `: ${edge.label}` : ''}`),
  ]
}

interface Props {
  board: Board
  title: string
  onChange?: (board: Board) => void
}

/** An accessible SVG diagram editor. Without onChange it renders a read-only diagram. */
export default function Whiteboard({ board, title, onChange }: Props) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<string>()
  const [kind, setKind] = useState<NodeKind>('service')
  const [label, setLabel] = useState('')
  const [target, setTarget] = useState('')
  const [edgeLabel, setEdgeLabel] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const editable = !!onChange
  const nodes = board.nodes.map(node => dragPos?.id === node.id ? { ...node, x: dragPos.x, y: dragPos.y } : node)
  const current = nodes.find(node => node.id === selected)
  const byId = new Map(nodes.map(node => [node.id, node]))

  function change(next: Board, message: string) {
    onChange?.(next)
    setAnnouncement(message)
  }

  function add() {
    if (board.nodes.length >= MAX_NODES) { setAnnouncement(`The board holds up to ${MAX_NODES} components.`); return }
    let n = board.nodes.length + 1
    while (board.nodes.some(node => node.id === `n${n}`)) n++
    const text = label.trim().slice(0, MAX_LABEL) || NODE_KIND_LABELS[kind]
    const node: BoardNode = { id: `n${n}`, kind, label: text, ...freeSlot(board) }
    change({ ...board, nodes: [...board.nodes, node] }, `Added ${text}.`)
    setSelected(node.id)
    setLabel('')
  }

  function update(nodeId: string, patch: Partial<BoardNode>, message = '') {
    change({ ...board, nodes: board.nodes.map(node => node.id === nodeId ? { ...node, ...patch } : node) }, message)
  }

  function remove(nodeId: string) {
    const node = board.nodes.find(item => item.id === nodeId)
    change({ nodes: board.nodes.filter(item => item.id !== nodeId), edges: board.edges.filter(edge => edge.from !== nodeId && edge.to !== nodeId) }, `Deleted ${node?.label || 'component'}.`)
    setSelected(undefined)
  }

  function connect() {
    if (!current || !target || target === current.id) return
    if (board.edges.length >= MAX_EDGES) { setAnnouncement(`The board holds up to ${MAX_EDGES} connections.`); return }
    if (board.edges.some(edge => edge.from === current.id && edge.to === target)) { setAnnouncement('Those components are already connected.'); return }
    const text = edgeLabel.trim().slice(0, MAX_LABEL)
    change({ ...board, edges: [...board.edges, { from: current.id, to: target, ...(text ? { label: text } : {}) }] }, `Connected ${current.label} to ${byId.get(target)?.label}.`)
    setTarget('')
    setEdgeLabel('')
  }

  function point(event: PointerEvent) {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: p.x, y: p.y }
  }

  function pointerDown(event: PointerEvent<SVGGElement>, node: BoardNode) {
    setSelected(node.id)
    if (!editable || event.button !== 0) return
    const p = point(event)
    drag.current = { id: node.id, dx: p.x - node.x, dy: p.y - node.y, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: PointerEvent<SVGGElement>) {
    if (!drag.current) return
    const p = point(event)
    drag.current.moved = true
    setDragPos({ id: drag.current.id, x: clamp(snap(p.x - drag.current.dx), 0, BOARD_WIDTH - NODE_WIDTH), y: clamp(snap(p.y - drag.current.dy), 0, BOARD_HEIGHT - NODE_HEIGHT) })
  }

  function pointerUp() {
    if (drag.current?.moved && dragPos) update(dragPos.id, { x: dragPos.x, y: dragPos.y })
    drag.current = null
    setDragPos(null)
  }

  function keyDown(event: KeyboardEvent<SVGGElement>, node: BoardNode) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(node.id); return }
    if (event.key === 'Escape') { setSelected(undefined); return }
    if (!editable) return
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(node.id); return }
    const step = event.shiftKey ? GRID * 5 : GRID
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
    if (!move) return
    event.preventDefault()
    setSelected(node.id)
    update(node.id, { x: clamp(node.x + move[0], 0, BOARD_WIDTH - NODE_WIDTH), y: clamp(node.y + move[1], 0, BOARD_HEIGHT - NODE_HEIGHT) })
  }

  const lines = describeBoard(board)
  const canvas = <svg ref={svg} className="wb-canvas" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
    role={editable ? 'group' : 'img'} aria-label={editable ? `${title}. ${board.nodes.length} components, ${board.edges.length} connections.` : `${title}: ${lines.join('; ')}`}
    onPointerDown={event => { if (event.target === svg.current) setSelected(undefined) }}>
    <defs>
      <pattern id={`${id}-grid`} width={GRID * 3} height={GRID * 3} patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="wb-dot" /></pattern>
      <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="wb-arrowhead" /></marker>
    </defs>
    <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill={`url(#${id}-grid)`} pointerEvents="none" />
    <g aria-hidden="true">{board.edges.map(edge => {
      const from = byId.get(edge.from), to = byId.get(edge.to)
      if (!from || !to) return null
      const dx = to.x - from.x, dy = to.y - from.y
      const a = border(from, dx, dy), b = border(to, -dx, -dy)
      return <g key={`${edge.from}>${edge.to}`} className="wb-edge">
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={`url(#${id}-arrow)`} />
        {edge.label && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle">{shortLabel(edge.label)}</text>}
      </g>
    })}</g>
    {nodes.map(node => <g key={node.id} className={`wb-node kind-${node.kind}${node.id === selected ? ' selected' : ''}`} transform={`translate(${node.x} ${node.y})`}
      {...(editable ? { tabIndex: 0, role: 'button', 'aria-pressed': node.id === selected, 'aria-label': `${node.label || 'Untitled'}, ${NODE_KIND_LABELS[node.kind]}` } : { 'aria-hidden': true })}
      onPointerDown={event => pointerDown(event, node)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
      onKeyDown={event => keyDown(event, node)} onFocus={() => editable && setSelected(node.id)}>
      <title>{`${node.label} (${NODE_KIND_LABELS[node.kind]})`}</title>
      <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="10" />
      <text className="wb-kind" x="12" y="20">{NODE_KIND_LABELS[node.kind]}</text>
      <text className="wb-label" x="12" y="41">{shortLabel(node.label)}</text>
    </g>)}
  </svg>

  if (!editable) return <figure className="whiteboard read-only"><div className="wb-scroll" tabIndex={0}>{canvas}</div><figcaption className="sr-only">{title}</figcaption></figure>

  return <div className="whiteboard">
    <div className="wb-toolbar" role="group" aria-label="Add a component">
      <label className="wb-field"><span>Type</span><select aria-label="Type" value={kind} onChange={event => setKind(event.target.value as NodeKind)}>{NODE_KINDS.map(item => <option key={item} value={item}>{NODE_KIND_LABELS[item]}</option>)}</select></label>
      <label className="wb-field grow"><span>Label</span><input aria-label="Label" value={label} maxLength={MAX_LABEL} placeholder={NODE_KIND_LABELS[kind]} onChange={event => setLabel(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} /></label>
      <button type="button" className="primary" onClick={add}>Add</button>
    </div>
    <div className="wb-scroll">{canvas}</div>
    <p className="wb-hint">Drag components, or focus one and use arrow keys (Shift for bigger steps). Delete removes it.</p>
    {current && <div className="wb-panel" role="group" aria-label={`Edit ${current.label || 'component'}`}>
      <label className="wb-field grow"><span>Rename</span><input aria-label="Rename" value={current.label} maxLength={MAX_LABEL} onChange={event => update(current.id, { label: event.target.value })} /></label>
      <label className="wb-field"><span>Type</span><select aria-label="Change type" value={current.kind} onChange={event => update(current.id, { kind: event.target.value as NodeKind })}>{NODE_KINDS.map(item => <option key={item} value={item}>{NODE_KIND_LABELS[item]}</option>)}</select></label>
      <label className="wb-field"><span>Connect to</span><select aria-label="Connect to" value={target} onChange={event => setTarget(event.target.value)}><option value="">Choose…</option>{board.nodes.filter(node => node.id !== current.id).map(node => <option key={node.id} value={node.id}>{node.label || 'Untitled'}</option>)}</select></label>
      <label className="wb-field"><span>Arrow label</span><input aria-label="Arrow label" value={edgeLabel} maxLength={MAX_LABEL} placeholder="optional" onChange={event => setEdgeLabel(event.target.value)} /></label>
      <div className="button-row"><button type="button" onClick={connect} disabled={!target}>Connect</button><button type="button" className="danger" onClick={() => remove(current.id)}>Delete</button></div>
    </div>}
    <details className="wb-details">
      <summary>Connections and text description ({board.edges.length})</summary>
      {board.edges.length ? <ul className="wb-edges">{board.edges.map(edge => <li key={`${edge.from}>${edge.to}`}><span>{byId.get(edge.from)?.label || 'Untitled'} → {byId.get(edge.to)?.label || 'Untitled'}{edge.label ? `: ${edge.label}` : ''}</span>
        <button type="button" className="text-button" onClick={() => change({ ...board, edges: board.edges.filter(item => item !== edge) }, 'Connection removed.')}>Remove</button></li>)}</ul> : <p>No connections yet. Select a component, then choose “Connect to”.</p>}
      {lines.length > 0 && <><h3>Text description</h3><ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul></>}
      <button type="button" className="text-button" disabled={!board.nodes.length} onClick={() => { if (window.confirm('Clear the whole board? This cannot be undone.')) change(emptyBoard(), 'Board cleared.') }}>Clear board</button>
    </details>
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </div>
}
