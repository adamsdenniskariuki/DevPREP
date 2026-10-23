import { bracketMatch } from './bracket-match'
import { cyclicMissing } from './cyclic-missing'
import { hashPair } from './hash-pair'
import { heapSort, kwayMerge, runningMedian, topK } from './heaps'
import { dropValue, middleNode, reverseList } from './linked'
import { mergeIntervals } from './merge-intervals'
import { minSpeed } from './min-speed'
import { nextGreater } from './next-greater'
import { prefixRange } from './prefix-range'
import { quickselect } from './quickselect'
import { simplifyPath } from './simplify-path'
import { sortedPair } from './sorted-pair'
import { sortedSearch } from './sorted-search'
import { spiralWalk } from './spiral'
import { levelOrderTracer, treeDepthTracer, treeOrderTracer } from './trees'
import { triePrefix } from './trie'
import type { Tracer } from './types'
import { variableWindow } from './variable-window'

export type { ArrayView, GridView, ListView, MapView, ParseResult, Trace, TraceFrame, Tracer, TracerParam, TreeView, TreeViewNode, VarValue } from './types'

export const TRACERS: Record<string, Tracer> = Object.fromEntries([
  hashPair, prefixRange, sortedPair, variableWindow,
  simplifyPath, bracketMatch, nextGreater, sortedSearch, minSpeed, dropValue, middleNode, reverseList, mergeIntervals, cyclicMissing,
  treeDepthTracer, treeOrderTracer, levelOrderTracer, triePrefix, heapSort, topK, kwayMerge, runningMedian, spiralWalk, quickselect,
].map(tracer => [tracer.id, tracer]))

export function getTracer(id: string): Tracer | undefined {
  return Object.hasOwn(TRACERS, id) ? TRACERS[id] : undefined
}
