import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { boundArrow, elementProblems, labelledShape } from './board-elements'
import { STENCILS, stencilLibrary } from './board-library'
import { EXCALIDRAW_VERSION } from './excalidraw-version'

describe('system design stencils', () => {
  const items = stencilLibrary()

  it('has all 12 stencils with unique ids and names', () => {
    expect(items.map(item => item.name)).toEqual(['Client', 'Load balancer', 'API gateway', 'Service', 'Cache', 'Database (SQL)', 'Database (NoSQL)', 'Queue / stream', 'CDN', 'Object storage', 'Search index', 'Worker'])
    expect(new Set(items.map(item => item.id)).size).toBe(12)
    expect(new Set(STENCILS.map(item => item.id)).size).toBe(12)
    const elementIds = items.flatMap(item => item.elements.map(element => element.id))
    expect(new Set(elementIds).size).toBe(elementIds.length)
  })

  it('builds each as a valid shape with a bound, grouped label', () => {
    for (const item of items) {
      expect(item.status).toBe('unpublished')
      expect(elementProblems(item.elements)).toEqual([])
      const [shape, text] = item.elements
      expect(['rectangle', 'ellipse', 'diamond']).toContain(shape.type)
      expect(text).toMatchObject({ type: 'text', text: item.name, containerId: shape.id })
      expect(shape.boundElements).toEqual([{ id: text.id, type: 'text' }])
      expect(shape.groupIds).toHaveLength(1)
      expect(text.groupIds).toEqual(shape.groupIds)
      expect(shape.width).toBeGreaterThan(0)
      expect(shape.height).toBeGreaterThan(0)
    }
  })

  it('is deterministic', () => {
    expect(stencilLibrary()).toEqual(items)
  })
})

describe('element builders', () => {
  it('binds arrows to both shapes', () => {
    const [a] = labelledShape({ id: 'a', type: 'rectangle', x: 0, y: 0, width: 100, height: 50, text: 'A' })
    const [b] = labelledShape({ id: 'b', type: 'rectangle', x: 300, y: 0, width: 100, height: 50, text: 'B' })
    const arrow = boundArrow('ab', a, b, 'calls')
    expect(arrow[0]).toMatchObject({ type: 'arrow', startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' } })
    expect(a.boundElements).toContainEqual({ id: 'ab', type: 'arrow' })
    expect(b.boundElements).toContainEqual({ id: 'ab', type: 'arrow' })
    expect(arrow[1]).toMatchObject({ type: 'text', text: 'calls', containerId: 'ab' })
  })

  it('reports broken bindings', () => {
    const [shape, text] = labelledShape({ id: 'a', type: 'rectangle', x: 0, y: 0, width: 100, height: 50, text: 'A' })
    expect(elementProblems([shape])).toEqual(['a: bound element a-label missing'])
    expect(elementProblems([{ ...shape, boundElements: null }, text])).toEqual(['a-label: container not bound'])
  })
})

it('pins the self-hosted Excalidraw assets to the installed version', () => {
  const pkg = JSON.parse(readFileSync('node_modules/@excalidraw/excalidraw/package.json', 'utf8')) as { version: string }
  expect(pkg.version).toBe(EXCALIDRAW_VERSION)
  const app = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> }
  expect(app.dependencies['@excalidraw/excalidraw']).toBe(EXCALIDRAW_VERSION)
})
