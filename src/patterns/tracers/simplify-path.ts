import type { Trace, TraceFrame, Tracer } from './types'

const MAX_PATH = 40
const MAX_PARTS = 12
const show = (part: string) => part === '' ? '""' : part

/** Stack: walk folder names, push each one, pop on "..", and skip "." and empty parts. */
export const simplifyPath: Tracer = {
  id: 'simplify-path',
  params: [{ name: 'path', label: 'Folder path', kind: 'text' }],
  parse(input) {
    const path = (input.path ?? '').trim()
    let error = ''
    if (!path) error = 'Enter a path that starts with /.'
    else if (path.length > MAX_PATH) error = `Use at most ${MAX_PATH} characters.`
    else if (!path.startsWith('/')) error = 'Start the path with /.'
    else if (!/^[A-Za-z0-9._/-]+$/.test(path)) error = 'Use only letters, digits, dots, dashes and /.'
    else if (path.split('/').length > MAX_PARTS) error = `Use at most ${MAX_PARTS - 1} slashes.`
    return error ? { ok: false, errors: { path: error } } : { ok: true, args: [path] }
  },
  run(args): Trace {
    const path = args[0] as string
    const parts = path.split('/')
    const stack: string[] = []
    const frames: TraceFrame[] = []
    let at: number | null = null
    const snap = (line: string, text: string) => frames.push({
      line,
      text,
      vars: { part: at === null ? null : show(parts[at]), depth: stack.length },
      view: {
        arrays: [
          { name: 'parts', label: 'path split on /', values: parts.map(show), pointers: at === null ? [] : [{ name: 'part', index: at }] },
          { name: 'stack', label: 'stack (top is last)', values: [...stack], pointers: stack.length ? [{ name: 'top', index: stack.length - 1 }] : [] },
        ],
      },
    })
    snap('init', `Split "${path}" on / into ${parts.length} parts and start with an empty stack.`)
    for (let i = 0; i < parts.length; i++) {
      at = i
      const part = parts[i]
      snap('loop', `Look at part ${i}: ${show(part)}.`)
      if (part === '' || part === '.') {
        snap('skip', part === '' ? 'An empty part (from a double or edge slash) changes nothing. Skip it.' : '"." means this folder. Skip it.')
        continue
      }
      if (part === '..') {
        const popped = stack.pop()
        snap('pop', popped === undefined ? '".." at the root has nowhere to go up to. Nothing to pop.' : `".." goes up one folder, so pop "${popped}".`)
        continue
      }
      stack.push(part)
      snap('push', `"${part}" is a folder name. Push it onto the stack.`)
    }
    at = null
    const result = '/' + stack.join('/')
    snap('done', `Join the stack with / to get ${result}.`)
    return { frames, result }
  },
  random(rand) {
    const tokens = ['a', 'b', 'docs', 'img', '.', '..', '..', '']
    const count = 1 + Math.floor(rand() * 7)
    return { path: '/' + Array.from({ length: count }, () => tokens[Math.floor(rand() * tokens.length)]).join('/') }
  },
}
