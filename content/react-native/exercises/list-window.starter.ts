export interface Layout { length: number; offset: number; index: number }
export interface WindowInput { offset: number; viewport: number; itemHeight: number; count: number; overscan: number }

export function itemLayout(index: number, height: number): Layout {
  return { length: height, offset: index, index }
}

export function visibleRange(input: WindowInput): { first: number; last: number } {
  // TODO
  return { first: 0, last: input.count - 1 }
}
