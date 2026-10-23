import { bracketMatch } from './bracket-match'
import { cyclicMissing } from './cyclic-missing'
import { hashPair } from './hash-pair'
import { dropValue, middleNode, reverseList } from './linked'
import { mergeIntervals } from './merge-intervals'
import { minSpeed } from './min-speed'
import { nextGreater } from './next-greater'
import { prefixRange } from './prefix-range'
import { simplifyPath } from './simplify-path'
import { sortedPair } from './sorted-pair'
import { sortedSearch } from './sorted-search'
import type { Tracer } from './types'
import { variableWindow } from './variable-window'

export type { ArrayView, ListView, MapView, ParseResult, Trace, TraceFrame, Tracer, TracerParam, VarValue } from './types'

export const TRACERS: Record<string, Tracer> = Object.fromEntries([
  hashPair, prefixRange, sortedPair, variableWindow,
  simplifyPath, bracketMatch, nextGreater, sortedSearch, minSpeed, dropValue, middleNode, reverseList, mergeIntervals, cyclicMissing,
].map(tracer => [tracer.id, tracer]))

export function getTracer(id: string): Tracer | undefined {
  return Object.hasOwn(TRACERS, id) ? TRACERS[id] : undefined
}
