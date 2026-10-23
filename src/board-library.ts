import { labelledShape, type SceneElement, type ShapeStyle, type ShapeType } from './board-elements'

export interface StencilSpec {
  id: string
  name: string
  type: ShapeType
  width: number
  height: number
  style: ShapeStyle
}

/** Original system-design stencils: one simple shape and a label each. Ids are append-only. */
export const STENCILS: readonly StencilSpec[] = [
  { id: 'client', name: 'Client', type: 'rectangle', width: 140, height: 70, style: { stroke: '#1971c2', fill: '#a5d8ff', rounded: true } },
  { id: 'load-balancer', name: 'Load balancer', type: 'diamond', width: 170, height: 100, style: { stroke: '#6741d9', fill: '#d0bfff' } },
  { id: 'api-gateway', name: 'API gateway', type: 'rectangle', width: 160, height: 70, style: { stroke: '#6741d9', fill: '#e5dbff' } },
  { id: 'service', name: 'Service', type: 'rectangle', width: 150, height: 70, style: { stroke: '#2f9e44', fill: '#b2f2bb', rounded: true } },
  { id: 'cache', name: 'Cache', type: 'rectangle', width: 130, height: 60, style: { stroke: '#e8590c', fill: '#ffd8a8', rounded: true, dashed: true } },
  { id: 'database-sql', name: 'Database (SQL)', type: 'ellipse', width: 170, height: 90, style: { stroke: '#f08c00', fill: '#ffec99' } },
  { id: 'database-nosql', name: 'Database (NoSQL)', type: 'ellipse', width: 180, height: 90, style: { stroke: '#f08c00', fill: '#fff3bf', dashed: true } },
  { id: 'queue', name: 'Queue / stream', type: 'rectangle', width: 190, height: 50, style: { stroke: '#e03131', fill: '#ffc9c9' } },
  { id: 'cdn', name: 'CDN', type: 'ellipse', width: 120, height: 70, style: { stroke: '#0c8599', fill: '#99e9f2' } },
  { id: 'object-storage', name: 'Object storage', type: 'rectangle', width: 170, height: 80, style: { stroke: '#099268', fill: '#96f2d7' } },
  { id: 'search-index', name: 'Search index', type: 'diamond', width: 170, height: 100, style: { stroke: '#9c36b5', fill: '#eebefa' } },
  { id: 'worker', name: 'Worker', type: 'rectangle', width: 140, height: 70, style: { stroke: '#495057', fill: '#dee2e6', rounded: true, dashed: true } },
]

export interface StencilItem {
  id: string
  status: 'unpublished'
  name: string
  created: number
  elements: SceneElement[]
}

/** Builds the stencils as Excalidraw library items. Each item's elements share one group so they move together. */
export function stencilLibrary(): StencilItem[] {
  return STENCILS.map(stencil => {
    const id = `devprep-${stencil.id}`
    return {
      id, status: 'unpublished', name: stencil.name, created: 1,
      elements: labelledShape({ id: `${id}-shape`, type: stencil.type, x: 0, y: 0, width: stencil.width, height: stencil.height, text: stencil.name, groupIds: [`${id}-group`], style: stencil.style }),
    }
  })
}
