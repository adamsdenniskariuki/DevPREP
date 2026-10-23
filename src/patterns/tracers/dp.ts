import { parseBinaryGrid, randomBinaryGrid } from './graph'
import { gridText, list, parseInts, parseOneInt, randomInts } from './parse'
import type { Trace, TraceFrame, Tracer } from './types'

type Cell = [number, number]
const EMPTY = '·'

/** A DP table for the grid view: filled cells show their value, the rest a dot. */
function tableCells(dp: readonly number[][], filled: readonly (readonly boolean[])[]) {
  return dp.map((row, r) => row.map((value, c) => (filled[r][c] ? value : EMPTY)))
}

const pointer = (name: string, index: number | null | undefined) => (index === null || index === undefined || index < 0 ? [] : [{ name, index }])

/** Merges pointers that share a cell, so each cell shows one tag such as "i-2, j". */
function pointers(...items: { name: string; index: number }[][]) {
  const byIndex = new Map<number, string[]>()
  for (const { name, index } of items.flat()) byIndex.set(index, [...(byIndex.get(index) ?? []), name])
  return [...byIndex].map(([index, names]) => ({ name: names.join(', '), index }))
}

/** 1-D DP: dp[i] is the best haul from the first i houses; each house is either skipped or taken with dp[i - 2]. */
export const houseRob: Tracer = {
  id: 'house-rob',
  params: [{ name: 'houses', label: 'Cash in each house', kind: 'ints' }],
  parse(input) {
    const houses = parseInts(input.houses, { min: 0, max: 99, maxItems: 8 })
    return typeof houses === 'string' ? { ok: false, errors: { houses } } : { ok: true, args: [houses] }
  },
  run(args): Trace {
    const houses = args[0] as number[]
    const n = houses.length
    const dp: number[] = Array(n + 1).fill(0)
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, i: number | null) => frames.push({
      line,
      text,
      vars: { n, i },
      view: {
        arrays: [
          { name: 'houses', label: 'houses', values: [...houses], pointers: pointer('house', i === null ? null : i - 1) },
          {
            name: 'dp',
            label: 'dp (dp[i] = most cash from the first i houses; highlighted = cells read)',
            values: dp.map((value, k) => (i === null || k <= i ? value : EMPTY)),
            pointers: i === null ? [] : pointers(pointer('i', i), pointer('i-1', i - 1), i >= 2 ? pointer('i-2', i - 2) : []),
            marked: i === null || i < 2 ? [] : [i - 1, i - 2],
          },
        ],
      },
    })
    snap('init', `There are ${n} house${n === 1 ? '' : 's'}. dp has ${n + 1} slots; dp[0] = 0 because no houses means no cash.`, null)
    dp[1] = houses[0]
    snap('base', `With only the first house, take it: dp[1] = ${houses[0]}.`, 1)
    for (let i = 2; i <= n; i++) {
      const skip = dp[i - 1]
      const take = dp[i - 2] + houses[i - 1]
      dp[i] = Math.max(skip, take)
      snap('fill', `House ${i - 1} holds ${houses[i - 1]}. Skip it and keep dp[${i - 1}] = ${skip}, or take it and add dp[${i - 2}]: ${dp[i - 2]} + ${houses[i - 1]} = ${take}. ${take > skip ? 'Take it' : 'Skip it'}: dp[${i}] = ${dp[i]}.`, i)
    }
    snap('done', `dp[${n}] covers every house. Return ${dp[n]}.`, null)
    return { frames, result: dp[n] }
  },
  random(rand) {
    return { houses: list(randomInts(rand, 1 + Math.floor(rand() * 8), 0, 30)) }
  },
}

/** 1-D DP with many choices: dp[i] is the longest rising run ending at i, built from every earlier smaller value. */
export const riseLength: Tracer = {
  id: 'rise-length',
  params: [{ name: 'nums', label: 'Numbers', kind: 'ints' }],
  parse(input) {
    const nums = parseInts(input.nums, { maxItems: 8 })
    return typeof nums === 'string' ? { ok: false, errors: { nums } } : { ok: true, args: [nums] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const dp = nums.map(() => 1)
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, i: number | null, j: number | null, extended = false) => frames.push({
      line,
      text,
      vars: { i, j },
      view: {
        arrays: [
          { name: 'nums', label: 'nums', values: [...nums], pointers: pointers(pointer('i', i), pointer('j', j)) },
          { name: 'dp', label: 'dp (dp[i] = longest rising run that ends at i; highlighted = the cell just used)', values: [...dp], pointers: pointers(pointer('i', i), pointer('j', j)), marked: extended && j !== null ? [j] : [] },
        ],
      },
    })
    snap('init', 'Every number on its own is a rising run of length 1, so dp starts as all 1s.', null, null)
    for (let i = 1; i < nums.length; i++) {
      for (let j = 0; j < i; j++) {
        if (nums[j] < nums[i]) {
          const before = dp[i]
          dp[i] = Math.max(dp[i], dp[j] + 1)
          snap('check', `${nums[j]} < ${nums[i]}, so the run ending at j can grow by ${nums[i]}: dp[j] + 1 = ${dp[j] + 1}. ${dp[i] > before ? `That beats ${before}, so dp[${i}] = ${dp[i]}.` : `That does not beat ${before}.`}`, i, j, true)
        } else {
          snap('check', `${nums[j]} is not smaller than ${nums[i]}, so a run ending at j cannot continue with it.`, i, j)
        }
      }
    }
    const best = Math.max(...dp)
    snap('done', `The longest run can end anywhere, so return the largest dp value: ${best}.`, null, null)
    return { frames, result: best }
  },
  random(rand) {
    return { nums: list(randomInts(rand, 1 + Math.floor(rand() * 8), 0, 20)) }
  },
}

/** 2-D grid DP: each open cell is reached from above or from the left, so its count is the sum of those two cells. */
export const gridPaths: Tracer = {
  id: 'grid-paths',
  params: [{ name: 'grid', label: 'Grid rows of 0 (open) and 1 (blocked), separated by /', kind: 'text' }],
  parse(input) {
    const grid = parseBinaryGrid(input.grid)
    return typeof grid === 'string' ? { ok: false, errors: { grid } } : { ok: true, args: [grid] }
  },
  run(args): Trace {
    const grid = args[0] as number[][]
    const rows = grid.length
    const cols = grid[0].length
    const dp = grid.map(row => row.map(() => 0))
    const filled = grid.map(row => row.map(() => false))
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, at?: Cell, deps: Cell[] = []) => frames.push({
      line,
      text,
      vars: { r: at ? at[0] : null, c: at ? at[1] : null },
      view: {
        arrays: [],
        grids: [{
          name: 'dp',
          label: 'dp (paths to each cell; # = blocked, · = not filled yet; double border = current, dotted = cells read)',
          cells: dp.map((row, r) => row.map((value, c) => (grid[r][c] === 1 ? '#' : filled[r][c] ? value : EMPTY))),
          ...(at ? { current: at } : {}),
          deps,
        }],
      },
    })
    snap('init', `The grid is ${rows} × ${cols}. dp[r][c] will count the paths from the top-left that move only right or down.`)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 1) {
          filled[r][c] = true
          snap('wall', `Row ${r}, column ${c} is blocked, so no path ends here: it stays 0.`, [r, c])
          continue
        }
        if (r === 0 && c === 0) {
          dp[r][c] = 1
          filled[r][c] = true
          snap('start', 'The start cell has exactly one path: standing still.', [0, 0])
          continue
        }
        const up = r > 0 ? dp[r - 1][c] : 0
        const left = c > 0 ? dp[r][c - 1] : 0
        dp[r][c] = up + left
        filled[r][c] = true
        const deps: Cell[] = [...(r > 0 ? [[r - 1, c] as Cell] : []), ...(c > 0 ? [[r, c - 1] as Cell] : [])]
        snap('fill', `Paths arrive from above (${r > 0 ? up : 'none, top row'}) or from the left (${c > 0 ? left : 'none, first column'}). dp[${r}][${c}] = ${up} + ${left} = ${dp[r][c]}.`, [r, c], deps)
      }
    }
    const result = dp[rows - 1][cols - 1]
    snap('done', `The bottom-right cell holds the answer: ${result} path${result === 1 ? '' : 's'}.`, [rows - 1, cols - 1])
    return { frames, result }
  },
  random(rand) {
    return { grid: gridText(randomBinaryGrid(rand, 0.2)) }
  },
}

/** 0/1 knapsack: row i adds one item; each cell either skips it (the cell above) or takes it (above and w to the left, plus its value). */
export const knapsack: Tracer = {
  id: 'knapsack',
  params: [
    { name: 'weights', label: 'Weights (up to 4 items)', kind: 'ints' },
    { name: 'values', label: 'Values, one per item', kind: 'ints' },
    { name: 'cap', label: 'Capacity (1 to 6)', kind: 'int' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const weights = parseInts(input.weights, { min: 1, max: 6, maxItems: 4 })
    if (typeof weights === 'string') errors.weights = weights
    const values = parseInts(input.values, { min: 1, max: 30, maxItems: 4 })
    if (typeof values === 'string') errors.values = values
    else if (typeof weights !== 'string' && values.length !== weights.length) errors.values = 'Give one value per weight.'
    const cap = parseOneInt(input.cap, 1, 6)
    if (typeof cap === 'string') errors.cap = cap
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [weights, values, cap] }
  },
  run(args): Trace {
    const weights = args[0] as number[]
    const values = args[1] as number[]
    const cap = args[2] as number
    const n = weights.length
    const dp = Array.from({ length: n + 1 }, () => Array(cap + 1).fill(0) as number[])
    const filled = dp.map((row, i) => row.map(() => i === 0))
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, i: number | null, c: number | null, deps: Cell[] = []) => frames.push({
      line,
      text,
      vars: { i, c, w: i ? weights[i - 1] : null, v: i ? values[i - 1] : null },
      view: {
        arrays: [{ name: 'items', label: 'items (weight:value)', values: weights.map((w, k) => `${w}:${values[k]}`), pointers: i ? [{ name: 'item', index: i - 1 }] : [] }],
        grids: [{
          name: 'dp',
          label: 'dp[i][c] = best value from the first i items within capacity c (rows: items, columns: capacity)',
          cells: tableCells(dp, filled),
          rowLabels: ['none', ...weights.map((w, k) => `${w}:${values[k]}`)],
          colLabels: Array.from({ length: cap + 1 }, (_, k) => String(k)),
          ...(i !== null && c !== null ? { current: [i, c] as Cell } : {}),
          deps,
        }],
      },
    })
    snap('init', `Row 0 means no items, so every capacity is worth 0. Each later row adds one item.`, null, null)
    for (let i = 1; i <= n; i++) {
      const w = weights[i - 1]
      const v = values[i - 1]
      snap('item', `Item ${i - 1} weighs ${w} and is worth ${v}. Fill row ${i} from capacity 0 up to ${cap}.`, i, null)
      for (let c = 0; c <= cap; c++) {
        dp[i][c] = dp[i - 1][c]
        if (w > c) {
          filled[i][c] = true
          snap('skip', `Capacity ${c} is less than the weight ${w}, so the item cannot go in. Copy the cell above: ${dp[i][c]}.`, i, c, [[i - 1, c]])
          continue
        }
        const take = dp[i - 1][c - w] + v
        dp[i][c] = Math.max(dp[i][c], take)
        filled[i][c] = true
        snap('take', `Skip it: ${dp[i - 1][c]} (above). Take it: ${dp[i - 1][c - w]} (row above, capacity ${c - w}) + ${v} = ${take}. Keep the larger: ${dp[i][c]}.`, i, c, [[i - 1, c], [i - 1, c - w]])
      }
    }
    snap('done', `The bottom-right cell uses every item and the full capacity. Return ${dp[n][cap]}.`, n, cap)
    return { frames, result: dp[n][cap] }
  },
  random(rand) {
    const n = 1 + Math.floor(rand() * 4)
    return { weights: list(randomInts(rand, n, 1, 6)), values: list(randomInts(rand, n, 1, 30)), cap: String(1 + Math.floor(rand() * 6)) }
  },
}

/** Parses two short lowercase words, like "abcd, acbd". */
function parseTwoWords(text: string | undefined): [string, string] | string {
  const words = (text ?? '').trim().split(/[\s,]+/).filter(Boolean)
  if (words.length !== 2) return 'Enter exactly two words, separated by a comma.'
  for (const word of words) {
    if (!/^[a-z]+$/.test(word)) return `“${word}” must use only the letters a to z, in lowercase.`
    if (word.length > 5) return 'Keep each word to at most 5 letters.'
  }
  return [words[0], words[1]]
}

const randomWord = (rand: () => number) => Array.from({ length: 1 + Math.floor(rand() * 5) }, () => 'abcd'[Math.floor(rand() * 4)]).join('')

/** LCS: matching letters extend the diagonal; otherwise drop a letter from one word and keep the better result. */
export const lcsTable: Tracer = {
  id: 'lcs-table',
  params: [{ name: 'words', label: 'Two words, separated by a comma', kind: 'text' }],
  parse(input) {
    const words = parseTwoWords(input.words)
    return typeof words === 'string' ? { ok: false, errors: { words } } : { ok: true, args: words }
  },
  run(args): Trace {
    const a = args[0] as string
    const b = args[1] as string
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0) as number[])
    const filled = dp.map((row, i) => row.map((_, j) => i === 0 || j === 0))
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, i: number | null, j: number | null, deps: Cell[] = []) => frames.push({
      line,
      text,
      vars: { i, j, 'a[i-1]': i ? a[i - 1] : null, 'b[j-1]': j ? b[j - 1] : null },
      view: {
        arrays: [],
        grids: [{
          name: 'dp',
          label: 'dp[i][j] = LCS of the first i letters of a (rows) and the first j of b (columns); – = empty prefix',
          cells: tableCells(dp, filled),
          rowLabels: ['–', ...a],
          colLabels: ['–', ...b],
          ...(i !== null && j !== null ? { current: [i, j] as Cell } : {}),
          deps,
        }],
      },
    })
    snap('init', `a = "${a}" and b = "${b}". Row 0 and column 0 stand for an empty prefix, which shares nothing, so they are 0.`, null, null)
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        filled[i][j] = true
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
          snap('match', `"${a[i - 1]}" = "${b[j - 1]}": both prefixes end in the same letter, so extend the diagonal: ${dp[i - 1][j - 1]} + 1 = ${dp[i][j]}.`, i, j, [[i - 1, j - 1]])
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
          snap('differ', `"${a[i - 1]}" ≠ "${b[j - 1]}": drop the last letter of one word. Above is ${dp[i - 1][j]}, left is ${dp[i][j - 1]}; keep ${dp[i][j]}.`, i, j, [[i - 1, j], [i, j - 1]])
        }
      }
    }
    const result = dp[a.length][b.length]
    snap('done', `The bottom-right cell compares the whole words. Return ${result}.`, a.length, b.length)
    return { frames, result }
  },
  random(rand) {
    return { words: `${randomWord(rand)}, ${randomWord(rand)}` }
  },
}

/** Interval DP: dp[i][j] is the best margin on nums[i..j]; it is built from the two intervals one shorter. */
export const endsGame: Tracer = {
  id: 'ends-game',
  params: [{ name: 'nums', label: 'Numbers in the row (up to 6)', kind: 'ints' }],
  parse(input) {
    const nums = parseInts(input.nums, { min: 0, max: 20, maxItems: 6 })
    return typeof nums === 'string' ? { ok: false, errors: { nums } } : { ok: true, args: [nums] }
  },
  run(args): Trace {
    const nums = args[0] as number[]
    const n = nums.length
    const dp = Array.from({ length: n }, () => Array(n).fill(0) as number[])
    const filled = dp.map(row => row.map(() => false))
    const frames: TraceFrame[] = []
    const snap = (line: string, text: string, i: number | null, j: number | null, deps: Cell[] = []) => frames.push({
      line,
      text,
      vars: { i, j, len: i !== null && j !== null ? j - i + 1 : null },
      view: {
        arrays: [{ name: 'nums', label: 'nums (window = the interval i..j)', values: [...nums], ...(i !== null && j !== null ? { window: [i, j] as [number, number] } : {}), pointers: pointers(pointer('i', i), pointer('j', j)) }],
        grids: [{
          name: 'dp',
          label: 'dp[i][j] = best margin the player to move can force on nums[i..j] (rows i, columns j; – = unused)',
          cells: dp.map((row, r) => row.map((value, c) => (c < r ? '–' : filled[r][c] ? value : EMPTY))),
          rowLabels: nums.map((_, k) => `i=${k}`),
          colLabels: nums.map((_, k) => `j=${k}`),
          ...(i !== null && j !== null ? { current: [i, j] as Cell } : {}),
          deps,
        }],
      },
    })
    snap('init', `Two players take turns removing a number from either end of [${nums.join(', ')}]. dp[i][j] is the best lead the player to move can force on nums[i..j].`, null, null)
    for (let i = 0; i < n; i++) {
      dp[i][i] = nums[i]
      filled[i][i] = true
      snap('single', `With one number left, take it: dp[${i}][${i}] = ${nums[i]}.`, i, i)
    }
    for (let len = 2; len <= n; len++) {
      for (let i = 0; i + len - 1 < n; i++) {
        const j = i + len - 1
        const left = nums[i] - dp[i + 1][j]
        const right = nums[j] - dp[i][j - 1]
        dp[i][j] = Math.max(left, right)
        filled[i][j] = true
        snap('fill', `On nums[${i}..${j}]: take the left end, ${nums[i]} − dp[${i + 1}][${j}] = ${left}, or the right end, ${nums[j]} − dp[${i}][${j - 1}] = ${right}. The opponent then moves on what is left, so subtract their best. Keep ${dp[i][j]}.`, i, j, [[i + 1, j], [i, j - 1]])
      }
    }
    snap('done', `dp[0][${n - 1}] covers the whole row. Return ${dp[0][n - 1]}${dp[0][n - 1] >= 0 ? ': the first player can at least tie' : ': the first player loses by that much'}.`, 0, n - 1)
    return { frames, result: dp[0][n - 1] }
  },
  random(rand) {
    return { nums: list(randomInts(rand, 1 + Math.floor(rand() * 6), 0, 20)) }
  },
}
