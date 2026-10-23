import type { Trace, TraceFrame, Tracer } from './types'

const MAX_INTERVALS = 8
const show = ([start, end]: number[]) => `${start}–${end}`

/** Intervals: sort by start, then sweep once, merging each interval into the last one when they overlap. */
export const mergeIntervals: Tracer = {
  id: 'merge-intervals',
  params: [{ name: 'intervals', label: 'Intervals', kind: 'text' }],
  parse(input) {
    const parts = (input.intervals ?? '').split(/[,;]/).map(part => part.trim()).filter(Boolean)
    let error = ''
    const intervals: number[][] = []
    if (!parts.length) error = 'Enter at least one interval, like 1-3.'
    else if (parts.length > MAX_INTERVALS) error = `Use at most ${MAX_INTERVALS} intervals.`
    else for (const part of parts) {
      const match = /^(\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(part)
      if (!match) { error = `“${part}” is not an interval. Write start-end, like 2-5, with numbers from 0 to 99.`; break }
      const [start, end] = [Number(match[1]), Number(match[2])]
      if (start > end) { error = `In “${part}” the start is after the end.`; break }
      intervals.push([start, end])
    }
    return error ? { ok: false, errors: { intervals: error } } : { ok: true, args: [intervals] }
  },
  run(args): Trace {
    const sorted = [...(args[0] as number[][])].map(item => [...item]).sort((a, b) => a[0] - b[0])
    const merged: number[][] = []
    const frames: TraceFrame[] = []
    let at: number | null = null
    const snap = (line: string, text: string, changed?: number) => frames.push({
      line,
      text,
      vars: { start: at === null ? null : sorted[at][0], end: at === null ? null : sorted[at][1], 'last end': merged.length ? merged[merged.length - 1][1] : null },
      view: {
        arrays: [
          { name: 'sorted', label: 'intervals sorted by start', values: sorted.map(show), pointers: at === null ? [] : [{ name: 'cur', index: at }], window: at === null ? undefined : [0, at] },
          { name: 'merged', label: 'merged', values: merged.map(show), pointers: merged.length ? [{ name: 'last', index: merged.length - 1 }] : [], marked: changed === undefined ? [] : [changed] },
        ],
      },
    })
    snap('init', `Sort by start: ${sorted.map(show).join(', ')}. Overlapping intervals are now next to each other.`)
    for (let i = 0; i < sorted.length; i++) {
      at = i
      const [start, end] = sorted[i]
      snap('loop', `Take ${show(sorted[i])}.`)
      const last = merged[merged.length - 1]
      if (last && start <= last[1]) {
        const before = show(last)
        last[1] = Math.max(last[1], end)
        snap('extend', `It starts at ${start}, before ${before} ends, so they overlap. Merge into ${show(last)}.`, merged.length - 1)
      } else {
        merged.push([start, end])
        snap('push', last ? `It starts at ${start}, after ${show(last)} ends at ${last[1]}. Start a new merged interval.` : 'Nothing is merged yet, so it starts the first merged interval.', merged.length - 1)
      }
    }
    at = null
    snap('done', `One pass is done. ${merged.length} merged interval${merged.length === 1 ? '' : 's'}: ${merged.map(show).join(', ')}.`)
    return { frames, result: merged }
  },
  random(rand) {
    const count = 1 + Math.floor(rand() * 6)
    return {
      intervals: Array.from({ length: count }, () => {
        const start = Math.floor(rand() * 20)
        return `${start}-${start + Math.floor(rand() * 6)}`
      }).join(', '),
    }
  },
}
