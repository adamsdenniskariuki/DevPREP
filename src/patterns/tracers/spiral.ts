import { gridText, parseGrid } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

const DIRECTIONS = ['right', 'down', 'left', 'up']

/** Matrix traversal: direction vectors turn a walk into data, so turning right is just d = (d + 1) % 4. */
export const spiralWalk: Tracer = {
  id: 'spiral-walk',
  params: [{ name: 'grid', label: 'Grid rows, separated by /', kind: 'text' }],
  parse(input) {
    const grid = parseGrid(input.grid)
    return typeof grid === 'string' ? { ok: false, errors: { grid } } : { ok: true, args: [grid] }
  },
  run(args): Trace {
    const grid = args[0] as number[][]
    const rows = grid.length
    const cols = grid[0].length
    const dr = [0, 1, 0, -1]
    const dc = [1, 0, -1, 0]
    const seen = grid.map(row => row.map(() => false))
    const visited: [number, number][] = []
    const out: number[] = []
    const frames: TraceFrame[] = []
    let r = 0
    let c = 0
    let d = 0
    const snap = (line: string, text: string, next?: [number, number]) => frames.push({
      line,
      text,
      vars: { r, c, d: `${d} (${DIRECTIONS[d]})`, nr: next ? next[0] : null, nc: next ? next[1] : null },
      view: {
        arrays: [{ name: 'out', label: 'out', values: [...out] }],
        grids: [{ name: 'grid', label: 'grid (solid = visited, double border = current cell)', cells: grid, current: [r, c], visited: [...visited] }],
      },
    })
    snap('init', `The grid is ${rows} × ${cols}. Start at the top-left corner, facing right. dr and dc hold the four steps: right, down, left, up.`)
    for (let step = 0; step < rows * cols; step++) {
      out.push(grid[r][c])
      seen[r][c] = true
      visited.push([r, c])
      snap('take', `Read ${grid[r][c]} at row ${r}, column ${c}, and mark it as seen.`)
      if (step === rows * cols - 1) break
      const next: [number, number] = [r + dr[d], c + dc[d]]
      snap('next', `One more step ${DIRECTIONS[d]} would land on row ${next[0]}, column ${next[1]}.`, next)
      const blocked = next[0] < 0 || next[0] >= rows || next[1] < 0 || next[1] >= cols || seen[next[0]][next[1]]
      if (blocked) {
        const outside = next[0] < 0 || next[0] >= rows || next[1] < 0 || next[1] >= cols
        d = (d + 1) % 4
        snap('turn', `That cell is ${outside ? 'outside the grid' : 'already seen'}, so turn right: now facing ${DIRECTIONS[d]}.`, next)
      } else {
        snap('turn', 'That cell is inside the grid and unseen, so keep the same direction.', next)
      }
      r += dr[d]
      c += dc[d]
      snap('move', `Step ${DIRECTIONS[d]} to row ${r}, column ${c}.`)
    }
    snap('done', `All ${rows * cols} cells were read once. Return [${out.join(', ')}].`)
    return { frames, result: out }
  },
  random(rand) {
    const rows = 1 + Math.floor(rand() * 5)
    const cols = 1 + Math.floor(rand() * 5)
    return { grid: gridText(Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.floor(rand() * 100)))) }
  },
}
