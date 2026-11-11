export interface Layout { length: number; offset: number; index: number }
export interface WindowInput { offset: number; viewport: number; itemHeight: number; count: number; overscan: number }

export function itemLayout(index: number, height: number): Layout {
  return { length: height, offset: index * height, index }
}

export function visibleRange({ offset, viewport, itemHeight, count, overscan }: WindowInput): { first: number; last: number } {
  if (count <= 0) return { first: 0, last: -1 }
  const first = Math.floor(offset / itemHeight) - overscan
  const last = Math.ceil((offset + viewport) / itemHeight) - 1 + overscan
  return { first: Math.max(0, first), last: Math.min(count - 1, last) }
}
