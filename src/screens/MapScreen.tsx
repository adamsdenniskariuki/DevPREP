import { useEffect, useMemo, useState } from 'react'
import type { AppModel } from '../app-model'
import { buildNavTree, loadNavData } from '../nav-model'
import type { NavData, NavNode } from '../nav-model'
import Icon from '../components/Icon'
import '../map.css'

type Count = NonNullable<NavNode['count']>

/** The sum of the section counts in a group, or undefined when none of its sections are counted. */
function groupCount(group: NavNode): Count | undefined {
  const counted = (group.children ?? []).filter(section => section.count)
  if (!counted.length) return undefined
  return counted.reduce((sum, section) => ({ done: sum.done + section.count!.done, total: sum.total + section.count!.total }), { done: 0, total: 0 })
}

const leaves = (nodes: readonly NavNode[]): number => nodes.reduce((sum, node) => sum + (node.children ? leaves(node.children) : 1), 0)
const fraction = (count: Count) => count.total ? count.done / count.total : 0

interface Layout { width: number; columns: number; gap: number; head: number; row: number; rowGap: number; top: number }
const WIDE: Layout = { width: 1000, columns: 5, gap: 20, head: 46, row: 54, rowGap: 8, top: 84 }
const TALL: Layout = { width: 360, columns: 1, gap: 18, head: 44, row: 50, rowGap: 6, top: 76 }

/** An overview of the five groups and their sections, drawn with theme colours. Decorative detail lives in the lists below. */
function MapDiagram({ tree, variant }: { tree: readonly NavNode[]; variant: 'wide' | 'tall' }) {
  const layout = variant === 'wide' ? WIDE : TALL
  const { width, columns, gap, head, row, rowGap, top } = layout
  const columnWidth = (width - gap * (columns - 1)) / columns
  const cardHeight = (group: NavNode) => head + 10 + (group.children?.length ?? 0) * (row + rowGap)
  let y = top
  const cards = tree.map((group, index) => {
    const column = index % columns
    const x = column * (columnWidth + gap)
    const at = columns === 1 ? y : top
    if (columns === 1) y += cardHeight(group) + gap
    return { group, x, y: at }
  })
  const height = columns === 1 ? y - gap + 2 : top + Math.max(...tree.map(cardHeight)) + 2
  const rootWidth = 150
  const rootX = width / 2 - rootWidth / 2
  const summary = tree.map(group => `${group.label}: ${(group.children ?? []).map(section => section.count ? `${section.label} ${section.count.done} of ${section.count.total}` : section.label).join(', ')}`).join('. ')
  const id = `map-diagram-${variant}`

  return <svg className={`map-svg map-diagram-${variant}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
    <title id={`${id}-title`}>DevPREP at a glance</title>
    <desc id={`${id}-desc`}>{summary}.</desc>
    <rect className="map-root" x={rootX} y={2} width={rootWidth} height={40} rx={20} />
    <text className="map-root-text" x={width / 2} y={27} textAnchor="middle">DevPREP</text>
    {columns === 1
      ? <path className="map-link" d={`M ${width / 2} 42 V ${top - 12}`} />
      : cards.map(({ group, x }) => <path key={group.id} className="map-link" d={`M ${width / 2} 42 V ${top - 22} H ${x + columnWidth / 2} V ${top}`} />)}
    {cards.map(({ group, x, y: cardY }) => {
      const total = groupCount(group)
      return <g key={group.id}>
        <rect className="map-card" x={x + 1} y={cardY} width={columnWidth - 2} height={cardHeight(group) - 2} rx={12} />
        <rect className="map-head" x={x + 1} y={cardY} width={columnWidth - 2} height={head} rx={12} />
        <text className="map-head-text" x={x + 14} y={cardY + head / 2 + 6}>{group.label}</text>
        {total && <text className="map-muted" x={x + columnWidth - 14} y={cardY + head / 2 + 5} textAnchor="end">{Math.round(fraction(total) * 100)}%</text>}
        {(group.children ?? []).map((section, index) => {
          const rowY = cardY + head + 8 + index * (row + rowGap)
          const inner = columnWidth - 28
          return <g key={section.id}>
            <rect className="map-row" x={x + 8} y={rowY} width={columnWidth - 16} height={row} rx={8} />
            <text className="map-row-text" x={x + 16} y={rowY + (section.count ? 22 : row / 2 + 5)}>{section.label}</text>
            {section.count && <>
              <text className="map-muted" x={x + columnWidth - 16} y={rowY + 22} textAnchor="end">{section.count.done}/{section.count.total}</text>
              <rect className="map-track" x={x + 16} y={rowY + row - 16} width={inner - 4} height={6} rx={3} />
              <rect className="map-fill" x={x + 16} y={rowY + row - 16} width={Math.max(fraction(section.count) * (inner - 4), section.count.done ? 6 : 0)} height={6} rx={3} />
            </>}
          </g>
        })}
      </g>
    })}
  </svg>
}

function MapList({ nodes }: { nodes: readonly NavNode[] }) {
  return <ul className="map-list">{nodes.map(node => <li key={node.id}>
    {node.href ? <a href={node.href}>{node.label}</a> : <span className="map-list-label">{node.label}</span>}
    {node.done && <span className="map-done"><Icon name="check" size={14} /><span className="sr-only">done</span></span>}
    {node.count && <span className="map-list-count">{node.count.done}/{node.count.total}</span>}
    {node.children && <MapList nodes={node.children} />}
  </li>)}</ul>
}

/** `#map`: the whole navigation tree on one page, with a progress bar per section. */
export default function MapScreen({ app }: { app: AppModel }) {
  const { progress, due, heading } = app
  const [data, setData] = useState<NavData>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    loadNavData().then(value => { if (live) setData(value) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  const tree = useMemo(() => buildNavTree(data?.deepSections(progress, data.index), due.length), [data, progress, due.length])

  return <>
    <div className="page-heading"><div><div className="eyebrow">SITE MAP</div><h1 ref={heading} tabIndex={-1}>Site map</h1>
      <p>Everything in DevPREP on one page, with how far you’ve got in each section. Press <kbd>Ctrl</kbd> <kbd>K</kbd> to search it.</p></div></div>
    <figure className="card map-figure">
      <MapDiagram tree={tree} variant="wide" />
      <MapDiagram tree={tree} variant="tall" />
      <figcaption>The five goals and their sections. Bars show the share of items done.</figcaption>
    </figure>
    {failed && <p className="alert" role="alert">The full item lists could not load. Sections still link to their pages.</p>}
    <div className="map-groups">
      {tree.map(group => <section key={group.id} className="card map-group" aria-labelledby={`map-${group.id}`}>
        <h2 id={`map-${group.id}`}>{group.icon && <Icon name={group.icon} size={20} />}{group.href ? <a href={group.href}>{group.label}</a> : group.label}</h2>
        <ul className="map-sections">{(group.children ?? []).map(section => {
          const headingId = `map-section-${section.id}`
          return <li key={section.id} className="map-section">
            <div className="map-section-head">
              <h3 id={headingId}>{section.href ? <a href={section.href}>{section.label}</a> : section.label}</h3>
              {section.count && <div className="map-progress">
                <progress value={section.count.done} max={section.count.total || 1} aria-label={`${section.label} progress`}
                  aria-valuetext={`${section.count.done} of ${section.count.total} done`} />
                <span className="map-count">{section.count.done}/{section.count.total}</span>
              </div>}
            </div>
            {section.pending && !failed && <p className="map-loading">Loading items…</p>}
            {section.children && <details className="map-details">
              <summary>Show {leaves(section.children)} items</summary>
              <MapList nodes={section.children} />
            </details>}
          </li>
        })}</ul>
      </section>)}
    </div>
  </>
}
