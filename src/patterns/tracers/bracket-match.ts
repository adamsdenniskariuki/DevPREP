import type { Trace, TraceFrame, Tracer } from './types'

const MAX_CHARS = 12
const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

/** Basic stack: push each opener, and pop to match each closer. */
export const bracketMatch: Tracer = {
  id: 'bracket-match',
  params: [{ name: 'text', label: 'Brackets', kind: 'text' }],
  parse(input) {
    const text = (input.text ?? '').replace(/\s+/g, '')
    let error = ''
    if (!text) error = 'Enter at least one bracket.'
    else if (text.length > MAX_CHARS) error = `Use at most ${MAX_CHARS} brackets.`
    else if (!/^[()[\]{}]+$/.test(text)) error = 'Use only the brackets ( ) [ ] { }.'
    return error ? { ok: false, errors: { text: error } } : { ok: true, args: [text] }
  },
  run(args): Trace {
    const text = args[0] as string
    const chars = [...text]
    const stack: string[] = []
    const frames: TraceFrame[] = []
    let at: number | null = null
    const snap = (line: string, text: string, marked?: number[]) => frames.push({
      line,
      text,
      vars: { ch: at === null ? null : chars[at], depth: stack.length },
      view: {
        arrays: [
          { name: 'text', label: 'text', values: chars, pointers: at === null ? [] : [{ name: 'ch', index: at }], marked },
          { name: 'stack', label: 'stack of open brackets (top is last)', values: [...stack], pointers: stack.length ? [{ name: 'top', index: stack.length - 1 }] : [] },
        ],
      },
    })
    snap('init', `Start with an empty stack and read "${text}" one bracket at a time.`)
    for (let i = 0; i < chars.length; i++) {
      at = i
      const ch = chars[i]
      snap('loop', `Read ${ch} at position ${i}.`)
      if (!(ch in PAIRS)) {
        stack.push(ch)
        snap('push', `${ch} opens a group. Push it and wait for its closer.`)
        continue
      }
      const top = stack.pop()
      if (top !== PAIRS[ch]) {
        snap('pop', top === undefined ? `${ch} closes a group, but the stack is empty. Return false.` : `${ch} needs ${PAIRS[ch]} on top, but the top is ${top}. Return false.`, [i])
        return { frames, result: false }
      }
      snap('pop', `${ch} matches the ${top} on top. Pop it.`)
    }
    at = null
    const result = stack.length === 0
    snap('done', result ? 'Every opener was closed and the stack is empty. Return true.' : `${stack.length} opener${stack.length === 1 ? ' was' : 's were'} never closed. Return false.`)
    return { frames, result }
  },
  random(rand) {
    const opens = '([{'
    const closes = ')]}'
    if (rand() < 0.5) {
      let text = ''
      const stack: number[] = []
      const length = 2 * (1 + Math.floor(rand() * 5))
      while (text.length < length) {
        if (stack.length && (rand() < 0.5 || stack.length * 2 >= length - text.length)) text += closes[stack.pop()!]
        else { const kind = Math.floor(rand() * 3); stack.push(kind); text += opens[kind] }
      }
      return { text }
    }
    const all = opens + closes
    return { text: Array.from({ length: 1 + Math.floor(rand() * 10) }, () => all[Math.floor(rand() * all.length)]).join('') }
  },
}
