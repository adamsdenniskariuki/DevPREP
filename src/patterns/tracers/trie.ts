import { parseWords } from './parse'
import type { Trace, TraceFrame, Tracer, TreeViewNode } from './types'

interface TrieNode { ch: string; count: number; end: boolean; next: Map<string, number> }

/** Tries: shared prefixes share a path, so a prefix query walks one node per letter. */
export const triePrefix: Tracer = {
  id: 'trie-prefix',
  params: [
    { name: 'words', label: 'Words', kind: 'text' },
    { name: 'prefix', label: 'Prefix to count', kind: 'text' },
  ],
  parse(input) {
    const errors: Record<string, string> = {}
    const words = parseWords(input.words, { minItems: 2, maxItems: 5, maxLength: 5 })
    const prefix = parseWords(input.prefix, { minItems: 1, maxItems: 1, maxLength: 5 })
    if (typeof words === 'string') errors.words = words
    if (typeof prefix === 'string') errors.prefix = prefix === 'Use at most 1 words.' ? 'Enter one prefix with no spaces.' : prefix
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, args: [words, (prefix as string[])[0]] }
  },
  run(args): Trace {
    const words = args[0] as string[]
    const prefix = args[1] as string
    const trie: TrieNode[] = [{ ch: 'root', count: 0, end: false, next: new Map() }]
    const frames: TraceFrame[] = []
    let node = 0
    let path: number[] = [0]
    let spelled = ''
    // The letters from the root to a node, used as a readable key.
    const pathText = (index: number): string => {
      let text = ''
      const walk = (at: number, sofar: string): boolean => {
        if (at === index) { text = sofar; return true }
        for (const [ch, child] of trie[at].next) if (walk(child, sofar + ch)) return true
        return false
      }
      walk(0, '')
      return text
    }
    const snap = (line: string, text: string, marked: number[] = []) => frames.push({
      line,
      text,
      vars: { word: spelled, 'node.count': node === 0 ? null : trie[node].count },
      view: {
        arrays: [],
        trees: [{
          name: 'trie',
          label: 'trie (square = ends a word, shaded = current path)',
          nodes: trie.map((item): TreeViewNode => ({ label: item.ch, children: [...item.next.values()], end: item.end })),
          pointers: [{ name: 'node', index: node }],
          active: [...path],
          marked,
        }],
        map: { label: 'count on each node of the path', entries: path.slice(1).map(index => [pathText(index), String(trie[index].count)]), highlight: node === 0 ? undefined : pathText(node) },
      },
    })
    snap('init', 'Start with an empty root node. Each child edge is one letter.')
    for (const word of words) {
      node = 0
      path = [0]
      spelled = ''
      snap('word', `Insert “${word}”, starting from the root.`)
      for (const ch of word) {
        const existing = trie[node].next.get(ch)
        spelled += ch
        if (existing === undefined) {
          trie.push({ ch, count: 0, end: false, next: new Map() })
          trie[node].next.set(ch, trie.length - 1)
          node = trie.length - 1
          path.push(node)
          snap('insert', `No child for “${ch}” yet, so create one and step into it.`)
        } else {
          node = existing
          path.push(node)
          snap('insert', `“${spelled}” is already a path. Reuse the “${ch}” node: the shared prefix is stored once.`)
        }
        trie[node].count++
        snap('count', `Add 1 to this node's count. ${trie[node].count} word${trie[node].count === 1 ? '' : 's'} pass${trie[node].count === 1 ? 'es' : ''} through “${spelled}”.`)
      }
      trie[node].end = true
      snap('end', `Mark the last node as the end of “${word}”.`)
    }
    node = 0
    path = [0]
    spelled = ''
    snap('lookup', `Now look up the prefix “${prefix}”, starting again from the root.`)
    for (const ch of prefix) {
      const child = trie[node].next.get(ch)
      if (child === undefined) {
        snap('check', `There is no “${ch}” child after “${spelled}”, so no word starts with “${prefix}”. Return 0.`)
        return { frames, result: 0 }
      }
      snap('check', `There is a “${ch}” child, so keep walking.`)
      node = child
      path.push(node)
      spelled += ch
      snap('step', `Step into “${spelled}”.`)
    }
    snap('done', `The prefix ends here. This node's count is ${trie[node].count}, so return ${trie[node].count}.`, [node])
    return { frames, result: trie[node].count }
  },
  random(rand) {
    const letters = 'abc'
    const word = (min: number) => Array.from({ length: min + Math.floor(rand() * (6 - min)) }, () => letters[Math.floor(rand() * letters.length)]).join('')
    return { words: Array.from({ length: 2 + Math.floor(rand() * 4) }, () => word(1)).join(', '), prefix: word(1).slice(0, 1 + Math.floor(rand() * 3)) }
  },
}
